import pytest

from worker.encryption import decrypt_from_storage, encrypt_for_storage


def test_roundtrip():
    ct = encrypt_for_storage("hello-josho")
    assert decrypt_from_storage(ct) == "hello-josho"


def test_unique_iv():
    a = encrypt_for_storage("same")
    b = encrypt_for_storage("same")
    assert a != b


def test_tamper():
    ct = bytearray(encrypt_for_storage("secret"))
    ct[-1] ^= 0x01
    with pytest.raises(Exception):
        decrypt_from_storage(bytes(ct))


def test_empty_rejected():
    with pytest.raises(ValueError):
        encrypt_for_storage("")
