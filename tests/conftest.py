import pytest
from httpx import ASGITransport, AsyncClient

from polymer_genomics.db import close_pool, init_pool
from polymer_genomics.main import app


@pytest.fixture
async def client():
    await init_pool()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    await close_pool()
