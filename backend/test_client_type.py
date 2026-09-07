from pydantic import ValidationError

from models import Client
from schemas import ClientCreate


def test_client_model_has_client_type_column():
    assert hasattr(Client, "client_type")


def test_client_create_requires_client_type():
    try:
        ClientCreate(name="Acme")
        assert False, "ClientCreate should require client_type"
    except ValidationError:
        pass

    client = ClientCreate(name="Acme", client_type="GST")
    assert client.client_type == "GST"

    non_gst = ClientCreate(name="Acme", client_type="NON_GST")
    assert non_gst.client_type == "NON_GST"
