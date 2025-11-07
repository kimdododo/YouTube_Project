"""
Backfill DAG: collect older videos up to 1 year, exclude Shorts
"""
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.utils.dates import days_ago
from datetime import timedelta
import os, sys

dag = DAG(
    'youtube_travel_backfill',
    default_args={
        'owner': 'data-engineer',
        'retries': 0,
    },
    description='Backfill last 1 year videos (no Shorts)',
    schedule_interval=None,
    start_date=days_ago(1),
    catchup=False,
    tags=['backfill'],
)

dag_dir = os.path.dirname(os.path.abspath(__file__))

# Docker 컨테이너(/opt/airflow)와 로컬 개발 환경 모두에서 utils 경로 설정
if dag_dir.startswith('/opt/airflow'):
    utils_path = '/opt/airflow/utils'
else:
    backend_root = os.path.dirname(os.path.dirname(dag_dir))
    utils_path = os.path.join(backend_root, 'utils')

if utils_path not in sys.path:
    sys.path.insert(0, utils_path)

from youtube_collector import YouTubeCollector
from db_writer import MySQLWriter
import json


def backfill_collect_and_load(**context):
    from airflow.models import Variable
    channel_list_path = os.path.join(dag_dir, 'channel_list.json')
    with open(channel_list_path, 'r', encoding='utf-8') as f:
        channels = [ch for ch in json.load(f) if ch.get('active', True)]

    api_keys_json = Variable.get("YOUTUBE_API_KEYS", default_var=None)
    if api_keys_json:
        api_keys = json.loads(api_keys_json)
    else:
        api_key = Variable.get("YOUTUBE_API_KEY")
        api_keys = [api_key]

    collector = YouTubeCollector(api_keys=api_keys)
    writer = MySQLWriter(conn_id=os.environ.get('AIRFLOW_MYSQL_CONN_ID', 'mysql_local'))
    writer.create_tables()

    total = 0
    for ch in channels:
        identifier = ch.get('channel_id') or ch.get('channel_handle') or ch.get('name')
        if not identifier:
            continue
        bundle = collector.collect_channel_videos(channel_id_or_handle=identifier, lookback_hours=8760, max_results=500)
        meta = bundle.get('channel_meta')
        vids = bundle.get('videos', [])
        if meta:
            writer.insert_channels([meta])
        if vids:
            writer.insert_videos(vids, keyword='travel')
            total += len(vids)
    print(f"Backfill loaded videos: {total}")
    return True


run = PythonOperator(
    task_id='backfill_collect_and_load',
    python_callable=backfill_collect_and_load,
    provide_context=True,
    dag=dag,
)


