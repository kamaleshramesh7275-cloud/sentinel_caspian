# Postmortem: ConnectionPoolExhausted in Payment Gateway
**Status**: Resolved
**Severity**: CRITICAL (Escalated via Clustering Override)
**Root Cause**: Unreleased raw database sockets in `process_checkout_transaction()`.
**Remediation**: Wrapped socket lifecycle in defensive `try...finally: await db_pool.release_socket(conn)`.
**Verification**: `pytest tests/test_payment_gateway_real.py` -- Passed (Exit 0).
**Timestamp**: 2026-09-17 16:58:10 UTC
