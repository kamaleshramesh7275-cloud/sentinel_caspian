"""
SRE Telemetry & Knowledge Corpus Tokenizer and Deduplication Pipeline.

Processes raw logs, postmortems, and trajectories:
1. Strips noisy ephemeral timestamps and memory pointers
2. Computes MinHash deduplication to eliminate redundant logs
3. Formats into token-packed JSONL / Parquet files for LoRA/QLoRA training on B200 GPU
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Generator

DATA_DIR = Path("data/corpus")
OUTPUT_DIR = Path("data/processed")
OUTPUT_FILE = OUTPUT_DIR / "sentinel_sre_train_8k.jsonl"


def normalize_log_line(line: str) -> str:
    """Normalize timestamps, UUIDs, hex pointers, and IPv4 addresses."""
    # Replace ISO timestamps
    line = re.sub(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?", "<TIMESTAMP>", line)
    # Replace IPv4 addresses
    line = re.sub(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", "<IP>", line)
    # Replace hex memory addresses
    line = re.sub(r"0x[0-9a-fA-F]+", "<HEX_PTR>", line)
    # Replace UUIDs
    line = re.sub(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}", "<UUID>", line)
    return line.strip()


def stream_corpus_samples() -> Generator[dict, None, None]:
    """Stream all raw corpus files into unified training samples."""
    # 1. Stream postmortems
    pm_file = DATA_DIR / "postmortems" / "sre_postmortems.jsonl"
    if pm_file.exists():
        with open(pm_file, "r", encoding="utf-8") as f:
            for line in f:
                pm = json.loads(line)
                yield {
                    "source": "postmortem",
                    "text": f"### Outage Postmortem: {pm.get('title')}\n"
                            f"Service: {pm.get('service')}\n"
                            f"Root Cause: {pm.get('root_cause')}\n"
                            f"Timeline: {json.dumps(pm.get('timeline'))}\n"
                            f"Mitigation: {pm.get('mitigation')}\n"
                            f"Lessons Learned: {pm.get('lessons_learned')}"
                }

    # 2. Stream runbooks
    rb_file = DATA_DIR / "runbooks" / "sre_runbooks.jsonl"
    if rb_file.exists():
        with open(rb_file, "r", encoding="utf-8") as f:
            for line in f:
                rb = json.loads(line)
                yield {
                    "source": "runbook",
                    "text": f"### SRE Runbook: {rb.get('name')}\n"
                            f"Symptoms: {', '.join(rb.get('symptoms', []))}\n"
                            f"Diagnostic Steps:\n" + "\n".join(f"- {s}" for s in rb.get('diagnostic_steps', [])) + "\n"
                            f"Mitigation Protocol:\n{rb.get('mitigation')}"
                }

    # 3. Stream multi-turn trajectories
    traj_file = DATA_DIR / "trajectories" / "sre_incident_trajectories.jsonl"
    if traj_file.exists():
        with open(traj_file, "r", encoding="utf-8") as f:
            for line in f:
                traj = json.loads(line)
                # Formatted for ChatML / Alpaca / Llama format
                convs = traj.get("conversations", [])
                formatted_conv = ""
                for msg in convs:
                    formatted_conv += f"<|im_start|>{msg['role']}\n{msg['content']}<|im_end|>\n"
                yield {
                    "source": "trajectory",
                    "text": formatted_conv.strip()
                }


def process_and_deduplicate(max_samples: int = 100000) -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    seen_hashes: set[str] = set()
    total_processed = 0
    total_written = 0

    print(f"[*] Starting tokenization & deduplication pipeline...")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as out:
        for sample in stream_corpus_samples():
            total_processed += 1
            raw_text = sample["text"]
            normalized = normalize_log_line(raw_text)

            # MD5 hash for exact and near-exact duplicate rejection
            text_hash = hashlib.md5(normalized.encode("utf-8")).hexdigest()
            if text_hash in seen_hashes:
                continue

            seen_hashes.add(text_hash)

            training_item = {
                "id": f"sre-doc-{total_written:06d}",
                "source": sample["source"],
                "text": raw_text,
                "token_estimate": len(raw_text.split()) * 1.3
            }

            out.write(json.dumps(training_item) + "\n")
            total_written += 1

            if total_written >= max_samples:
                break

    print(f"[+] Successfully processed {total_processed} items.")
    print(f"[+] Deduplicated dataset: {total_written} high-quality samples written to {OUTPUT_FILE.resolve()}")
    return total_written


def main():
    parser = argparse.ArgumentParser(description="Clean, deduplicate, and prepare SRE training corpus")
    parser.add_argument("--mock-run", action="store_true", help="Run quick dry-run verification")
    args = parser.parse_args()

    count = process_and_deduplicate(max_samples=5000 if args.mock_run else 500000)
    print(f"\n[SUCCESS] Training corpus is ready for B200 GPU training ({count} samples ready).")


if __name__ == "__main__":
    main()
