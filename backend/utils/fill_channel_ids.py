"""
channel_list.json의 빈 channel_id 필드를 채우는 유틸리티 스크립트

사용법:
    python fill_channel_ids.py

이 스크립트는:
1. channel_list.json을 읽습니다
2. channel_id가 비어있고 channel_handle이 있는 채널을 찾습니다
3. YouTube API로 channel_handle → channel_id 변환을 수행합니다
4. 업데이트된 channel_list.json을 저장합니다

주의: 이 스크립트는 API 할당량을 소모합니다.
"""

import json
import os
import sys

# 상위 디렉토리 경로 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.youtube_collector import YouTubeCollector


def load_channel_list(file_path: str):
    """channel_list.json 로드"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_channel_list(file_path: str, data: list):
    """channel_list.json 저장"""
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"✓ Saved to {file_path}")


def fill_missing_channel_ids(channel_list: list, collector: YouTubeCollector):
    """빈 channel_id 필드 채우기 (API 키 로테이션 지원)"""
    updated_count = 0
    failed_count = 0
    quota_exceeded_count = 0
    no_handle_count = 0
    
    missing_ids = [ch for ch in channel_list if not (ch.get('channel_id') or "").strip()]
    total_to_process = len(missing_ids)
    
    print(f"Processing {total_to_process} channels with missing channel_id...")
    print(f"{'='*60}")
    
    for idx, ch in enumerate(missing_ids, 1):
        channel_name = ch.get('name', 'Unknown')
        channel_handle = (ch.get('channel_handle') or "").strip()
        
        # 할당량 초과 체크
        if len(collector.quota_exceeded_keys) >= len(collector.api_keys):
            print(f"\n⚠️ All {len(collector.api_keys)} API keys have exceeded quota.")
            print(f"  Processed: {idx - 1}/{total_to_process}")
            print(f"  Updated: {updated_count}")
            print(f"  Failed: {failed_count}")
            print(f"  Remaining: {total_to_process - idx + 1} channels")
            break
        
        channel_id = None
        
        # 방법 1: channel_handle이 있으면 handle로 검색
        if channel_handle:
            print(f"[{idx}/{total_to_process}] Resolving handle '{channel_handle}' for '{channel_name}'...")
            try:
                channel_id = collector.get_channel_id_by_handle(channel_handle)
                if channel_id:
                    print(f"    ✓ Found via handle: {channel_id}")
                else:
                    print(f"    ✗ Not found via handle")
            except Exception as e:
                error_msg = str(e)
                if 'quotaExceeded' in error_msg or 'quota' in error_msg.lower():
                    quota_exceeded_count += 1
                    print(f"    ✗ API quota exceeded for current key")
                    print(f"    → {len(collector.quota_exceeded_keys)}/{len(collector.api_keys)} keys exhausted")
                else:
                    print(f"    ✗ Error with handle: {e}")
        
        # 방법 2: handle로 실패했거나 handle이 없으면 이름으로 검색
        if not channel_id and channel_name and channel_name != 'Unknown':
            if channel_handle:
                print(f"    → Trying name search as fallback...")
            else:
                print(f"[{idx}/{total_to_process}] Resolving by name '{channel_name}' (no handle)...")
            try:
                channel_id = collector.get_channel_id_by_name(channel_name)
                if channel_id:
                    print(f"    ✓ Found via name: {channel_id}")
                else:
                    if not channel_handle:
                        print(f"    ✗ Not found via name")
            except Exception as e:
                error_msg = str(e)
                if 'quotaExceeded' in error_msg or 'quota' in error_msg.lower():
                    quota_exceeded_count += 1
                    print(f"    ✗ API quota exceeded for current key")
                    print(f"    → {len(collector.quota_exceeded_keys)}/{len(collector.api_keys)} keys exhausted")
                else:
                    print(f"    ✗ Error with name search: {e}")
        
        # 결과 처리
        if channel_id:
            ch['channel_id'] = channel_id
            updated_count += 1
        else:
            failed_count += 1
            if not channel_handle:
                no_handle_count += 1
                print(f"    ✗ Failed: No handle and name search failed")
        
        # 진행률 표시 (10개마다)
        if idx % 10 == 0:
            print(f"\n  Progress: {idx}/{total_to_process} ({idx/total_to_process*100:.1f}%)")
            print(f"  Updated: {updated_count}, Failed: {failed_count}")
            print(f"  API Keys exhausted: {len(collector.quota_exceeded_keys)}/{len(collector.api_keys)}")
            print()
    
    return updated_count, failed_count, no_handle_count


def main():
    """메인 함수"""
    # 파일 경로 설정
    script_dir = os.path.dirname(os.path.abspath(__file__))
    channel_list_path = os.path.join(script_dir, '..', 'dags', 'channel_list.json')
    channel_list_path = os.path.normpath(channel_list_path)
    
    if not os.path.exists(channel_list_path):
        print(f"✗ Error: channel_list.json not found at {channel_list_path}")
        return
    
    print(f"Loading channel_list.json from: {channel_list_path}")
    
    # channel_list.json 로드
    channel_list = load_channel_list(channel_list_path)
    print(f"Loaded {len(channel_list)} channels")
    
    # channel_id가 없는 채널 개수 확인
    missing_ids = [ch for ch in channel_list if not (ch.get('channel_id') or "").strip()]
    print(f"Channels missing channel_id: {len(missing_ids)}")
    
    if len(missing_ids) == 0:
        print("✓ All channels already have channel_id. Nothing to do.")
        return
    
    # YouTube API 키 설정 (여러 키 지원)
    api_keys = None
    
    # 1. 환경변수에서 여러 키 확인
    api_keys_json = os.environ.get('YOUTUBE_API_KEYS')
    if api_keys_json:
        try:
            import json
            api_keys = json.loads(api_keys_json)
            if isinstance(api_keys, list) and len(api_keys) > 0:
                print(f"Using {len(api_keys)} API keys from YOUTUBE_API_KEYS environment variable")
        except json.JSONDecodeError:
            print("⚠️ YOUTUBE_API_KEYS is not valid JSON, ignoring...")
    
    # 2. 단일 키 환경변수 확인
    if not api_keys:
        api_key = os.environ.get('YOUTUBE_API_KEY')
        if api_key:
            api_keys = [api_key]
            print(f"Using single API key from YOUTUBE_API_KEY environment variable")
    
    # 3. Airflow Variables에서 가져오기 시도
    if not api_keys:
        try:
            from airflow.models import Variable
            api_keys_json = Variable.get("YOUTUBE_API_KEYS", default_var=None)
            if api_keys_json:
                import json
                api_keys = json.loads(api_keys_json)
                if isinstance(api_keys, list) and len(api_keys) > 0:
                    print(f"Using {len(api_keys)} API keys from Airflow Variables")
        except Exception as e:
            print(f"⚠️ Could not load from Airflow Variables: {e}")
    
    if not api_keys:
        print("✗ Error: API keys not found")
        print("  Set it before running this script:")
        print("  Option 1: $env:YOUTUBE_API_KEYS = '[\"key1\", \"key2\", ...]'")
        print("  Option 2: $env:YOUTUBE_API_KEY = 'your-api-key'")
        print("\n  Or use Airflow Variables (if running in Airflow environment)")
        return
    
    # YouTubeCollector 초기화 (여러 키 지원)
    print(f"\nInitializing YouTubeCollector with {len(api_keys)} API keys for rotation...")
    if len(api_keys) > 3:
        for i, key in enumerate(api_keys[:3], 1):
            print(f"  Key {i}: {key[:20]}...")
        print(f"  ... and {len(api_keys) - 3} more keys")
    else:
        for i, key in enumerate(api_keys, 1):
            print(f"  Key {i}: {key[:20]}...")
    
    collector = YouTubeCollector(api_keys=api_keys)
    
    print(f"\nFilling missing channel_ids...")
    print(f"{'='*60}")
    
    # channel_id 채우기
    updated_count, failed_count, no_handle_count = fill_missing_channel_ids(channel_list, collector)
    
    print(f"\n{'='*60}")
    print(f"Summary:")
    print(f"  - Updated: {updated_count}")
    print(f"  - Failed: {failed_count}")
    print(f"  - API Keys exhausted: {len(collector.quota_exceeded_keys)}/{len(collector.api_keys)}")
    if updated_count + failed_count > 0:
        success_rate = updated_count/(updated_count+failed_count)*100
        print(f"  - Success rate: {success_rate:.1f}%")
        print(f"  - Remaining quota: {len(collector.api_keys) - len(collector.quota_exceeded_keys)} API keys available")
    
    # 실패 분석
    if failed_count > 0:
        print(f"\n실패 분석:")
        print(f"  - Handle 없는 채널: {no_handle_count}개")
        print(f"  - Handle은 있으나 찾지 못한 채널: {failed_count - no_handle_count}개")
        
        if len(collector.quota_exceeded_keys) < len(collector.api_keys):
            print(f"\n💡 해결 방법:")
            print(f"  1. 실패한 채널들의 handle을 수동으로 확인")
            print(f"  2. YouTube에서 직접 채널 ID 확인 후 channel_list.json에 추가")
            print(f"  3. 나머지 API 키로 재시도 (현재 {len(collector.api_keys) - len(collector.quota_exceeded_keys)}개 키 사용 가능)")
    
    print(f"{'='*60}")
    
    if updated_count > 0:
        # 백업 생성
        backup_path = channel_list_path + '.backup'
        backup_data = load_channel_list(channel_list_path)  # 원본 다시 로드
        save_channel_list(backup_path, backup_data)
        print(f"\n✓ Backup created: {backup_path}")
        
        # 업데이트된 데이터 저장
        save_channel_list(channel_list_path, channel_list)
        print(f"\n✓ Updated {updated_count} channels in channel_list.json")
        print("  You can now run the DAG again with more efficient API usage.")
    else:
        print("\n⚠️ No channels were updated. Check the errors above.")


if __name__ == '__main__':
    main()

