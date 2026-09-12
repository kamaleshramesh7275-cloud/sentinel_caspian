"""
Direct downloader for missing model-00001-of-00004.safetensors shard.
Uses requests streaming with progress bar — bypasses huggingface_hub stall.
"""
import os
import sys
import requests

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

HF_TOKEN = os.getenv("HF_TOKEN", "")
MODEL_REPO = "Qwen/Qwen2.5-Coder-7B-Instruct"
SHARD_FILE = "model-00001-of-00004.safetensors"

# HF cache blob directory
import pathlib
cache_root = pathlib.Path.home() / ".cache" / "huggingface" / "hub" / "models--Qwen--Qwen2.5-Coder-7B-Instruct"
blob_dir = cache_root / "blobs"
snapshot_dir = cache_root / "snapshots"

# Find existing snapshot hash
snapshots = list(snapshot_dir.glob("*"))
if not snapshots:
    print("[ERROR] No snapshot directory found. Run preload_model.py first.")
    sys.exit(1)

snap_hash = snapshots[0].name
out_path = blob_dir / f"{SHARD_FILE}.direct_download"
final_path = blob_dir / SHARD_FILE

if final_path.exists() and final_path.stat().st_size > 1_000_000_000:
    print(f"[OK] {SHARD_FILE} already exists ({final_path.stat().st_size / 1e9:.2f} GB). Nothing to do.")
    # Write ready flag
    with open("model_cache_ready.flag", "w") as f:
        f.write(str(snapshots[0]))
    print("[OK] model_cache_ready.flag written. Ready to train!")
    sys.exit(0)

url = f"https://huggingface.co/{MODEL_REPO}/resolve/main/{SHARD_FILE}"
headers = {"Authorization": f"Bearer {HF_TOKEN}"}

print(f"[*] Downloading: {SHARD_FILE}")
print(f"[*] URL: {url}")
print(f"[*] Output: {final_path}")

blob_dir.mkdir(parents=True, exist_ok=True)

response = requests.get(url, headers=headers, stream=True, timeout=120)
response.raise_for_status()

total = int(response.headers.get("content-length", 0))
downloaded = 0
chunk_size = 8 * 1024 * 1024  # 8 MB chunks

with open(out_path, "wb") as f:
    for chunk in response.iter_content(chunk_size=chunk_size):
        if chunk:
            f.write(chunk)
            downloaded += len(chunk)
            pct = downloaded / total * 100 if total else 0
            mb = downloaded / 1e6
            print(f"\r[*] Progress: {mb:.0f} MB / {total/1e6:.0f} MB ({pct:.1f}%)", end="", flush=True)

print(f"\n[OK] Download complete: {downloaded/1e9:.2f} GB")

# Rename to final path
os.rename(out_path, final_path)
print(f"[OK] Shard saved: {final_path}")

# Write ready flag
with open("model_cache_ready.flag", "w") as f:
    f.write(str(snapshots[0]))
print("[OK] model_cache_ready.flag written. Ready to train!")
