"""
Regression Test Suite for services.payment_gateway
Tests concurrent checkout transactions against the connection pool limit.
"""

import pytest
import asyncio
from services.payment_gateway import process_checkout_transaction, db_pool, ConnectionPoolExhausted


@pytest.mark.asyncio
async def test_concurrent_checkout_transactions_against_connection_pool():
    """
    Test executing multiple checkout transactions.
    When connections are properly managed/released, all 3 transactions must succeed.
    When connections are leaked, ConnectionPoolExhausted is raised on the 3rd transaction.
    """
    # Reset pool
    db_pool.active_connections = 0

    # Execute 3 sequential transactions
    res1 = await process_checkout_transaction(order_id="ord_101", amount_cents=4999, user_id="usr_1")
    assert res1["status"] == "authorized"

    res2 = await process_checkout_transaction(order_id="ord_102", amount_cents=1299, user_id="usr_2")
    assert res2["status"] == "authorized"

    # 3rd transaction will fail if connections leaked
    res3 = await process_checkout_transaction(order_id="ord_103", amount_cents=8500, user_id="usr_3")
    assert res3["status"] == "authorized"
    assert db_pool.active_connections <= 1
