import urllib.request
import json

def main():
    cases = ['payment_db_leak', 'redis_cache_stampede', 'worker_oom_leak', 'webhook_retry_storm', 'custom_repo']
    for c in cases:
        url = f'http://127.0.0.1:8000/incidents/agent-live-telemetry?agent_id=rca&case_id={c}'
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            print(f"CASE {c}: status={resp.status}, target={data.get('target_file')}, prompt_tokens={data['token_count']['prompt']}, completion_tokens={data['token_count']['completion']}")

    # Test POST custom repo payload
    post_url = 'http://127.0.0.1:8000/incidents/agent-live-telemetry'
    payload = json.dumps({
        'agent_id': 'sandbox',
        'case_id': 'custom_repo',
        'custom_code': 'async def test(): session = get_session(); return 1',
        'custom_error': 'SessionNotClosedError'
    }).encode()
    req = urllib.request.Request(post_url, data=payload, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        print(f"POST CUSTOM REPO: status={resp.status}, agent={data['agent_id']}, tokens={data['token_count']['total']}")
        print("AST Unified Diff excerpt in raw_output:")
        raw = json.loads(data['raw_output'])
        print(raw.get('patch_proposal', {}).get('unified_diff', '')[:120])

if __name__ == '__main__':
    main()
