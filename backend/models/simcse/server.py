"""
SimCSE 모델 서버 (Cloud Run용)
ONNX 모델을 사용하여 텍스트 임베딩 생성
Cloud Storage에서 모델을 다운로드하여 사용
"""
from fastapi import FastAPI
from pydantic import BaseModel
import numpy as np
import os
import logging
import asyncio
from google.cloud import storage

# ONNX Runtime은 지연 로드 (필요할 때만 import)
ort = None

# Transformers 토크나이저 (지연 로드)
tokenizer = None

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="SimCSE Embedding Server",
    description="SimCSE ONNX 모델을 사용한 텍스트 임베딩 생성 서버",
    version="1.0.0"
)

# Cloud Storage 설정
GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "")
GCS_MODEL_PATH = os.getenv("GCS_MODEL_PATH", "models/simcse/model.onnx")  # Cloud Storage 내 경로
LOCAL_MODEL_PATH = os.getenv("MODEL_PATH", "/app/model/model.onnx")  # 로컬 저장 경로

# 토크나이저 설정
GCS_TOKENIZER_PATH = os.getenv("GCS_TOKENIZER_PATH", "tokenizer")  # Cloud Storage 내 토크나이저 경로
LOCAL_TOKENIZER_PATH = os.getenv("LOCAL_TOKENIZER_PATH", "/app/tokenizer")  # 로컬 저장 경로
TOKENIZER_MODEL_NAME = os.getenv("TOKENIZER_MODEL_NAME", "BM-K/KoSimCSE-roberta-multitask")  # HuggingFace fallback

# ONNX 모델 세션
session = None


def download_model_from_gcs(bucket_name: str, gcs_path: str, local_path: str) -> bool:
    """
    Cloud Storage에서 ONNX 모델 다운로드
    
    Args:
        bucket_name: GCS 버킷 이름
        gcs_path: GCS 내 모델 파일 경로
        local_path: 로컬 저장 경로
        
    Returns:
        다운로드 성공 여부
    """
    try:
        # 로컬 디렉토리 생성
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        
        # Cloud Storage 클라이언트 생성
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(gcs_path)
        
        # 원본 파일 크기 확인
        if not blob.exists():
            logger.error(f"[SimCSE] Model file does not exist in GCS: gs://{bucket_name}/{gcs_path}")
            return False
        
        # blob 메타데이터 새로고침 (size 정보 가져오기)
        blob.reload()
        original_size = blob.size
        
        if original_size is None:
            logger.warning(f"[SimCSE] Could not get file size from GCS, will verify after download")
            original_size = 440388894  # 알려진 파일 크기 (fallback)
        
        logger.info(f"[SimCSE] Downloading model from gs://{bucket_name}/{gcs_path} to {local_path}")
        logger.info(f"[SimCSE] Original file size: {original_size} bytes")
        
        # 모델 다운로드 (재시도 로직 포함, 청크 단위 다운로드)
        max_retries = 3
        for attempt in range(max_retries):
            try:
                logger.info(f"[SimCSE] Download attempt {attempt + 1}/{max_retries}")
                
                # 기존 파일이 있으면 삭제 (손상된 파일 방지)
                if os.path.exists(local_path):
                    try:
                        os.remove(local_path)
                    except:
                        pass
                
                # 청크 단위로 다운로드 (대용량 파일 안정성 향상)
                try:
                    # 직접 다운로드 시도
                    blob.download_to_filename(local_path)
                except Exception as direct_download_error:
                    logger.warning(f"[SimCSE] Direct download failed, trying chunked download: {direct_download_error}")
                    # 청크 단위 다운로드로 재시도
                    with open(local_path, 'wb') as f:
                        blob.download_to_file(f)
                
                # 다운로드된 파일 크기 확인
                downloaded_size = os.path.getsize(local_path)
                logger.info(f"[SimCSE] Downloaded file size: {downloaded_size} bytes (Original: {original_size} bytes)")
                
                # 파일 크기 검증 (원본 크기가 None이 아닐 때만)
                expected_size = 440388894  # 알려진 파일 크기
                if original_size and original_size > 0:
                    expected_size = original_size
                
                # 파일 크기가 예상 크기와 일치하는지 확인 (약간의 오차 허용)
                size_diff = abs(downloaded_size - expected_size)
                size_tolerance = expected_size * 0.01  # 1% 오차 허용
                
                if size_diff > size_tolerance:
                    logger.warning(f"[SimCSE] File size mismatch! Expected: {expected_size}, Downloaded: {downloaded_size}, Diff: {size_diff}")
                    if attempt < max_retries - 1:
                        logger.info(f"[SimCSE] Retrying download...")
                        if os.path.exists(local_path):
                            try:
                                os.remove(local_path)
                            except:
                                pass
                        continue
                    else:
                        # 마지막 시도에서는 크기가 비슷하면 허용 (다운로드는 성공했을 수 있음)
                        if downloaded_size > expected_size * 0.9:  # 90% 이상이면 허용
                            logger.warning(f"[SimCSE] File size slightly different but acceptable: {downloaded_size} vs {expected_size}")
                        else:
                            logger.error(f"[SimCSE] File size mismatch after {max_retries} attempts")
                            return False
                
                if downloaded_size == 0:
                    logger.error(f"[SimCSE] Downloaded file is empty!")
                    if attempt < max_retries - 1:
                        logger.info(f"[SimCSE] Retrying download...")
                        if os.path.exists(local_path):
                            try:
                                os.remove(local_path)
                            except:
                                pass
                        continue
                    else:
                        return False
                
                # 파일 무결성 검증: 첫 몇 바이트 확인
                try:
                    with open(local_path, 'rb') as f:
                        header = f.read(32)
                        # ONNX protobuf 파일은 보통 특정 바이트 패턴을 가짐
                        if len(header) < 8:
                            raise ValueError("File too small to be valid ONNX")
                        # "pytorch" 또는 protobuf 매직 넘버 확인
                        if b'pytorch' not in header and header[0] != 0x08:
                            logger.warning(f"[SimCSE] File header does not look like ONNX protobuf: {header[:16].hex()}")
                except Exception as header_error:
                    logger.warning(f"[SimCSE] Could not verify file header: {header_error}")
                
                logger.info(f"[SimCSE] Model downloaded successfully: {local_path} ({downloaded_size} bytes)")
                return True
            except Exception as download_error:
                logger.error(f"[SimCSE] Download attempt {attempt + 1} failed: {download_error}", exc_info=True)
                if attempt < max_retries - 1:
                    logger.info(f"[SimCSE] Retrying download...")
                    # 파일이 부분적으로 다운로드되었을 수 있으므로 삭제
                    if os.path.exists(local_path):
                        try:
                            os.remove(local_path)
                        except:
                            pass
                else:
                    logger.error(f"[SimCSE] Failed to download after {max_retries} attempts")
                    return False
        
        return False
    except Exception as e:
        logger.error(f"[SimCSE] Failed to download model from GCS: {e}", exc_info=True)
        return False


def download_tokenizer_from_gcs(bucket_name: str, gcs_path: str, local_path: str) -> bool:
    """
    Cloud Storage에서 토크나이저 다운로드
    
    Args:
        bucket_name: GCS 버킷 이름
        gcs_path: GCS 내 토크나이저 폴더 경로 (예: "tokenizer")
        local_path: 로컬 저장 경로
        
    Returns:
        다운로드 성공 여부
    """
    try:
        # 로컬 디렉토리 생성
        os.makedirs(local_path, exist_ok=True)
        
        # Cloud Storage 클라이언트 생성
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        
        # 토크나이저 폴더 내 모든 파일 목록 가져오기
        blobs = bucket.list_blobs(prefix=f"{gcs_path}/")
        
        downloaded_files = []
        for blob in blobs:
            # 폴더 자체는 건너뛰기
            if blob.name.endswith('/'):
                continue
            
            # 로컬 파일 경로 생성
            relative_path = blob.name[len(gcs_path):].lstrip('/')
            local_file_path = os.path.join(local_path, relative_path)
            
            # 디렉토리 생성
            os.makedirs(os.path.dirname(local_file_path), exist_ok=True)
            
            # 파일 다운로드
            try:
                blob.download_to_filename(local_file_path)
                downloaded_files.append(relative_path)
                logger.info(f"[SimCSE] Downloaded tokenizer file: {relative_path}")
            except Exception as download_error:
                logger.error(f"[SimCSE] Failed to download tokenizer file {relative_path}: {download_error}")
                return False
        
        if not downloaded_files:
            logger.error(f"[SimCSE] No tokenizer files found in gs://{bucket_name}/{gcs_path}/")
            return False
        
        logger.info(f"[SimCSE] Tokenizer downloaded successfully: {len(downloaded_files)} files")
        logger.info(f"[SimCSE] Tokenizer files: {', '.join(downloaded_files[:5])}{'...' if len(downloaded_files) > 5 else ''}")
        return True
        
    except Exception as e:
        logger.error(f"[SimCSE] Failed to download tokenizer from GCS: {e}", exc_info=True)
        return False


def load_model():
    """ONNX 모델 로드 (Cloud Storage에서 다운로드 후)"""
    global session
    
    # 1. 로컬에 모델 파일이 있는지 확인
    if os.path.exists(LOCAL_MODEL_PATH):
        logger.info(f"[SimCSE] Using existing local model: {LOCAL_MODEL_PATH}")
    else:
        # 2. Cloud Storage에서 다운로드
        if GCS_BUCKET_NAME:
            logger.info(f"[SimCSE] Model not found locally, downloading from GCS...")
            logger.info(f"[SimCSE] Downloading from bucket: {GCS_BUCKET_NAME}, path: {GCS_MODEL_PATH}")
            if not download_model_from_gcs(GCS_BUCKET_NAME, GCS_MODEL_PATH, LOCAL_MODEL_PATH):
                logger.error("[SimCSE] Failed to download model from GCS")
                logger.error(f"[SimCSE] Check if file exists: gs://{GCS_BUCKET_NAME}/{GCS_MODEL_PATH}")
                return
        else:
            logger.error(f"[SimCSE] GCS_BUCKET_NAME not set. Cannot download model.")
            return
    
    # 3. ONNX 모델 로드
    try:
        logger.info(f"[SimCSE] Loading ONNX model from: {LOCAL_MODEL_PATH}")
        if not os.path.exists(LOCAL_MODEL_PATH):
            logger.error(f"[SimCSE] Model file does not exist at: {LOCAL_MODEL_PATH}")
            session = None
            return
        
        # 파일 크기 확인
        file_size = os.path.getsize(LOCAL_MODEL_PATH)
        logger.info(f"[SimCSE] Model file size: {file_size} bytes")
        
        if file_size == 0:
            logger.error(f"[SimCSE] Model file is empty! Re-downloading...")
            # 빈 파일 삭제 후 재다운로드
            os.remove(LOCAL_MODEL_PATH)
            if GCS_BUCKET_NAME:
                if not download_model_from_gcs(GCS_BUCKET_NAME, GCS_MODEL_PATH, LOCAL_MODEL_PATH):
                    logger.error("[SimCSE] Failed to re-download model")
                    session = None
                    return
            else:
                logger.error("[SimCSE] GCS_BUCKET_NAME not set, cannot re-download")
                session = None
                return
        
        # ONNX Runtime 지연 로드 (모듈 레벨에서 import 시도)
        global ort
        if ort is None:
            try:
                logger.info("[SimCSE] Importing onnxruntime...")
                import onnxruntime as ort
                logger.info("[SimCSE] onnxruntime imported successfully")
            except Exception as import_error:
                logger.error(f"[SimCSE] Failed to import onnxruntime: {import_error}", exc_info=True)
                session = None
                return
        
        logger.info(f"[SimCSE] Creating InferenceSession...")
        
        # ONNX Runtime 세션 옵션 설정
        sess_options = ort.SessionOptions()
        sess_options.log_severity_level = 3  # ERROR 레벨만 로깅
        
        try:
            session = ort.InferenceSession(
                LOCAL_MODEL_PATH, 
                sess_options=sess_options,
                providers=["CPUExecutionProvider"]
            )
            logger.info(f"[SimCSE] ONNX model loaded successfully from: {LOCAL_MODEL_PATH}")
            logger.info(f"[SimCSE] Model input names: {[inp.name for inp in session.get_inputs()]}")
            logger.info(f"[SimCSE] Model output names: {[out.name for out in session.get_outputs()]}")
            logger.info(f"[SimCSE] Model input shapes: {[inp.shape for inp in session.get_inputs()]}")
            logger.info(f"[SimCSE] Model output shapes: {[out.shape for out in session.get_outputs()]}")
        except ort.capi.onnxruntime_pybind11_state.InvalidProtobuf as protobuf_error:
            logger.error(f"[SimCSE] Protobuf parsing failed. This might indicate:")
            logger.error(f"[SimCSE] 1. File corruption during download")
            logger.error(f"[SimCSE] 2. ONNX Runtime version incompatibility")
            logger.error(f"[SimCSE] 3. Model file format issue")
            logger.error(f"[SimCSE] Error details: {protobuf_error}")
            raise
    except Exception as e:
        logger.error(f"[SimCSE] Failed to load ONNX model: {e}", exc_info=True)
        # 모델 파일이 손상되었을 수 있으므로 삭제 후 재다운로드 시도
        if os.path.exists(LOCAL_MODEL_PATH):
            logger.warning(f"[SimCSE] Removing potentially corrupted model file: {LOCAL_MODEL_PATH}")
            try:
                os.remove(LOCAL_MODEL_PATH)
            except Exception as remove_error:
                logger.error(f"[SimCSE] Failed to remove corrupted file: {remove_error}")
        session = None


# 서버 시작 시 모델 로드 (백그라운드)
@app.on_event("startup")
async def startup_event():
    """서버 시작 시 모델 로드 (백그라운드)"""
    try:
        logger.info("[SimCSE] Starting SimCSE model server...")
        logger.info(f"[SimCSE] GCS_BUCKET_NAME: {GCS_BUCKET_NAME}")
        logger.info(f"[SimCSE] GCS_MODEL_PATH: {GCS_MODEL_PATH}")
        logger.info(f"[SimCSE] LOCAL_MODEL_PATH: {LOCAL_MODEL_PATH}")
        logger.info(f"[SimCSE] GCS_TOKENIZER_PATH: {GCS_TOKENIZER_PATH}")
        logger.info(f"[SimCSE] LOCAL_TOKENIZER_PATH: {LOCAL_TOKENIZER_PATH}")
        logger.info(f"[SimCSE] TOKENIZER_MODEL_NAME (fallback): {TOKENIZER_MODEL_NAME}")
        
        # 서버는 먼저 시작하고, 모델과 토크나이저는 백그라운드에서 로드
        logger.info("[SimCSE] Server started successfully - FastAPI is ready")
        logger.info("[SimCSE] Model and Tokenizer will be loaded in background")
        
        # 모델과 토크나이저 로드를 백그라운드 태스크로 실행 (서버 시작을 블로킹하지 않음)
        # ONNX Runtime import 오류가 있어도 서버는 시작되어야 함
        try:
            asyncio.create_task(load_model_async())
            asyncio.create_task(load_tokenizer_async())
        except Exception as e:
            logger.warning(f"[SimCSE] Failed to start background loading tasks: {e}")
            logger.info("[SimCSE] Model and Tokenizer will be loaded on first /predict request")
    except Exception as e:
        # startup 이벤트에서 오류가 발생해도 서버는 시작되어야 함
        logger.error(f"[SimCSE] Error in startup event: {e}", exc_info=True)
        logger.info("[SimCSE] Server will continue without background model loading")


async def load_model_async():
    """비동기 모델 로드"""
    try:
        # 동기 함수를 별도 스레드에서 실행
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, load_model)
        
        if session is None:
            logger.warning("[SimCSE] Model not loaded - server will return errors for /predict requests")
        else:
            logger.info("[SimCSE] Model loaded successfully in background")
    except Exception as e:
        logger.error(f"[SimCSE] Error loading model in background: {e}", exc_info=True)
        logger.warning("[SimCSE] Server will continue without model - /predict will return errors")


async def load_tokenizer_async():
    """비동기 토크나이저 로드"""
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, load_tokenizer)
        if tokenizer is None:
            logger.warning("[SimCSE] Tokenizer not loaded in background")
        else:
            logger.info("[SimCSE] Tokenizer loaded successfully in background")
    except Exception as e:
        logger.error(f"[SimCSE] Error loading tokenizer in background: {e}", exc_info=True)
        logger.warning("[SimCSE] Server will continue without tokenizer - /predict might fail if not loaded on demand")


class InputText(BaseModel):
    """입력 텍스트 모델"""
    text: str


class SimilarityInput(BaseModel):
    """유사도 계산 입력 모델"""
    text1: str
    text2: str


def load_tokenizer():
    """토크나이저 로드 (지연 로드) - Cloud Storage 우선, 없으면 HuggingFace"""
    global tokenizer
    if tokenizer is None:
        try:
            from transformers import AutoTokenizer
            
            # 1. 로컬 토크나이저 경로 확인
            if os.path.exists(LOCAL_TOKENIZER_PATH) and os.path.exists(os.path.join(LOCAL_TOKENIZER_PATH, "tokenizer_config.json")):
                logger.info(f"[SimCSE] Loading tokenizer from local path: {LOCAL_TOKENIZER_PATH}")
                tokenizer = AutoTokenizer.from_pretrained(LOCAL_TOKENIZER_PATH, local_files_only=True)
                logger.info(f"[SimCSE] Tokenizer loaded successfully from local path")
                return tokenizer
            
            # 2. Cloud Storage에서 다운로드 시도
            if GCS_BUCKET_NAME and GCS_TOKENIZER_PATH:
                logger.info(f"[SimCSE] Local tokenizer not found, downloading from Cloud Storage...")
                logger.info(f"[SimCSE] Downloading from bucket: {GCS_BUCKET_NAME}, path: {GCS_TOKENIZER_PATH}")
                
                if download_tokenizer_from_gcs(GCS_BUCKET_NAME, GCS_TOKENIZER_PATH, LOCAL_TOKENIZER_PATH):
                    # 다운로드 성공 후 로컬에서 로드
                    if os.path.exists(os.path.join(LOCAL_TOKENIZER_PATH, "tokenizer_config.json")):
                        logger.info(f"[SimCSE] Loading tokenizer from downloaded files: {LOCAL_TOKENIZER_PATH}")
                        tokenizer = AutoTokenizer.from_pretrained(LOCAL_TOKENIZER_PATH, local_files_only=True)
                        logger.info(f"[SimCSE] Tokenizer loaded successfully from Cloud Storage")
                        return tokenizer
                    else:
                        logger.warning(f"[SimCSE] Tokenizer files downloaded but tokenizer_config.json not found")
                else:
                    logger.warning(f"[SimCSE] Failed to download tokenizer from Cloud Storage, trying HuggingFace fallback...")
            
            # 3. HuggingFace에서 다운로드 (fallback)
            logger.info(f"[SimCSE] Downloading tokenizer from HuggingFace: {TOKENIZER_MODEL_NAME}")
            tokenizer = AutoTokenizer.from_pretrained(TOKENIZER_MODEL_NAME)
            logger.info(f"[SimCSE] Tokenizer loaded successfully from HuggingFace: {TOKENIZER_MODEL_NAME}")
            
        except Exception as e:
            logger.error(f"[SimCSE] Failed to load tokenizer: {e}", exc_info=True)
            raise
    return tokenizer


def tokenize_text(text: str, max_length: int = 128) -> tuple:
    """
    텍스트를 토크나이즈하여 input_ids와 attention_mask 생성
    
    Args:
        text: 입력 텍스트
        max_length: 최대 시퀀스 길이
        
    Returns:
        (input_ids, attention_mask) 튜플 (numpy arrays)
    """
    try:
        tok = load_tokenizer()
        
        # 토크나이즈
        encoded = tok(
            text,
            padding="max_length",
            truncation=True,
            max_length=max_length,
            return_tensors="np"
        )
        
        input_ids = encoded["input_ids"].astype(np.int64)
        attention_mask = encoded["attention_mask"].astype(np.int64)
        
        logger.debug(f"[SimCSE] Tokenized text: {text[:50]}... -> input_ids shape: {input_ids.shape}")
        
        return input_ids, attention_mask
    except Exception as e:
        logger.error(f"[SimCSE] Error tokenizing text: {e}", exc_info=True)
        raise


@app.get("/")
def root():
    """루트 엔드포인트"""
    return {
        "message": "SimCSE Embedding Server",
        "version": "1.0.0",
        "status": "running",
        "model_loaded": session is not None,
        "onnxruntime_available": _check_onnxruntime_available(),
        "tokenizer_loaded": tokenizer is not None
    }


@app.get("/health")
def health_check():
    """헬스 체크 엔드포인트"""
    return {
        "status": "healthy",
        "model_loaded": session is not None,
        "onnxruntime_available": _check_onnxruntime_available(),
        "tokenizer_loaded": tokenizer is not None
    }


def _check_onnxruntime_available() -> bool:
    """ONNX Runtime 사용 가능 여부 확인 (안전한 방식)"""
    try:
        # 동적으로 import 시도 (모듈 레벨 import 아님)
        import importlib
        importlib.import_module('onnxruntime')
        return True
    except Exception as e:
        logger.debug(f"[SimCSE] onnxruntime not available: {e}")
        return False


@app.post("/predict")
def predict(data: InputText):
    """
    텍스트 임베딩 생성
    
    Args:
        data: InputText 모델 (text 필드 포함)
        
    Returns:
        {
            "vector": [임베딩 벡터 리스트],
            "dimension": 768
        }
    """
    global session
    
    # 모델이 로드되지 않았으면 지금 로드 시도
    if session is None:
        logger.info("[SimCSE] Model not loaded, attempting to load now...")
        try:
            load_model()
        except Exception as e:
            logger.error(f"[SimCSE] Failed to load model: {e}", exc_info=True)
            return {
                "error": "Model not loaded",
                "message": str(e),
                "vector": None
            }
    
    if session is None:
        logger.error("[SimCSE] Model still not loaded after load attempt")
        return {
            "error": "Model not loaded",
            "vector": None
        }
    
    try:
        # 텍스트를 토크나이즈하여 input_ids와 attention_mask 생성
        logger.info(f"[SimCSE] Tokenizing text: {data.text[:50]}...")
        input_ids, attention_mask = tokenize_text(data.text, max_length=128)
        
        logger.info(f"[SimCSE] Running model with input_ids shape: {input_ids.shape}, attention_mask shape: {attention_mask.shape}")
        
        # ONNX 모델 실행 (올바른 입력 이름 사용)
        result = session.run(
            None, 
            {
                "input_ids": input_ids,
                "attention_mask": attention_mask
            }
        )
        
        # 결과 반환 (sentence_embedding 출력)
        embedding_vector = result[0].tolist() if result else None
        
        logger.info(f"[SimCSE] Generated embedding for text: {data.text[:50]}...")
        logger.info(f"[SimCSE] Embedding shape: {result[0].shape if result else None}")
        
        return {
            "vector": embedding_vector,
            "dimension": len(embedding_vector[0]) if embedding_vector else 0
        }
    except Exception as e:
        logger.error(f"[SimCSE] Error generating embedding: {e}", exc_info=True)
        return {
            "error": str(e),
            "vector": None
        }


def cosine_similarity(vec1: np.ndarray, vec2: np.ndarray) -> float:
    """
    두 벡터 간 코사인 유사도 계산
    
    Args:
        vec1: 첫 번째 벡터 (1D numpy array)
        vec2: 두 번째 벡터 (1D numpy array)
        
    Returns:
        코사인 유사도 (0.0 ~ 1.0)
    """
    # 벡터 정규화
    vec1_norm = vec1 / (np.linalg.norm(vec1) + 1e-8)
    vec2_norm = vec2 / (np.linalg.norm(vec2) + 1e-8)
    
    # 코사인 유사도 계산
    similarity = np.dot(vec1_norm, vec2_norm)
    
    # -1 ~ 1 범위를 0 ~ 1 범위로 변환 (선택사항, 일반적으로 -1 ~ 1 사용)
    # similarity = (similarity + 1) / 2
    
    return float(similarity)


@app.post("/similarity")
def calculate_similarity(data: SimilarityInput):
    """
    두 텍스트 간 유사도 계산
    
    Args:
        data: SimilarityInput 모델 (text1, text2 필드 포함)
        
    Returns:
        {
            "similarity": 0.0 ~ 1.0 (코사인 유사도),
            "text1": 첫 번째 텍스트,
            "text2": 두 번째 텍스트,
            "text1_embedding": 첫 번째 텍스트의 임베딩 벡터 (선택사항),
            "text2_embedding": 두 번째 텍스트의 임베딩 벡터 (선택사항)
        }
    """
    global session
    
    # 모델이 로드되지 않았으면 지금 로드 시도
    if session is None:
        logger.info("[SimCSE] Model not loaded, attempting to load now...")
        try:
            load_model()
        except Exception as e:
            logger.error(f"[SimCSE] Failed to load model: {e}", exc_info=True)
            return {
                "error": "Model not loaded",
                "message": str(e),
                "similarity": None
            }
    
    if session is None:
        logger.error("[SimCSE] Model still not loaded after load attempt")
        return {
            "error": "Model not loaded",
            "similarity": None
        }
    
    try:
        # 두 텍스트를 토크나이즈
        logger.info(f"[SimCSE] Calculating similarity between: '{data.text1[:50]}...' and '{data.text2[:50]}...'")
        
        input_ids1, attention_mask1 = tokenize_text(data.text1, max_length=128)
        input_ids2, attention_mask2 = tokenize_text(data.text2, max_length=128)
        
        # 두 텍스트의 임베딩 생성
        result1 = session.run(
            None,
            {
                "input_ids": input_ids1,
                "attention_mask": attention_mask1
            }
        )
        
        result2 = session.run(
            None,
            {
                "input_ids": input_ids2,
                "attention_mask": attention_mask2
            }
        )
        
        # 임베딩 벡터 추출 (배치 차원 제거)
        embedding1 = result1[0][0]  # shape: (768,)
        embedding2 = result2[0][0]  # shape: (768,)
        
        # 코사인 유사도 계산
        similarity = cosine_similarity(embedding1, embedding2)
        
        logger.info(f"[SimCSE] Similarity calculated: {similarity:.4f}")
        
        return {
            "similarity": similarity,
            "text1": data.text1,
            "text2": data.text2,
            "text1_embedding": embedding1.tolist(),
            "text2_embedding": embedding2.tolist()
        }
    except Exception as e:
        logger.error(f"[SimCSE] Error calculating similarity: {e}", exc_info=True)
        return {
            "error": str(e),
            "similarity": None
        }

