"""
Python mirror of web/lib/encryption.ts — MUST stay byte-compatible.

Format: [ version (1B=0x01) | iv (12B) | auth-tag (16B) | ciphertext ]
Cipher: AES-256-GCM, key = base64-decoded ENCRYPTION_KEY (32 bytes).
"""

from __future__ import annotations

import base64
import os
from functools import cache

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ENCRYPTION_VERSION = 0x01
IV_LENGTH = 12
TAG_LENGTH = 16


@cache
def _load_key() -> bytes:
    raw = os.environ["ENCRYPTION_KEY"]
    key = base64.b64decode(raw)
    if len(key) != 32:
        raise ValueError(f"ENCRYPTION_KEY must decode to 32 bytes; got {len(key)}")
    return key


def encrypt_for_storage(plaintext: str) -> bytes:
    if not plaintext:
        raise ValueError("plaintext must be non-empty")
    iv = os.urandom(IV_LENGTH)
    aes = AESGCM(_load_key())
    ct_and_tag = aes.encrypt(iv, plaintext.encode("utf-8"), None)
    # cryptography returns ciphertext || tag; but our wire format is [iv|tag|ct]
    ct, tag = ct_and_tag[:-TAG_LENGTH], ct_and_tag[-TAG_LENGTH:]
    return bytes([ENCRYPTION_VERSION]) + iv + tag + ct


def decrypt_from_storage(blob: bytes | memoryview) -> str:
    buf = bytes(blob)
    if len(buf) < 1 + IV_LENGTH + TAG_LENGTH + 1:
        raise ValueError("blob too short")
    version = buf[0]
    if version != ENCRYPTION_VERSION:
        raise ValueError(f"unknown encryption version {version}")
    iv = buf[1 : 1 + IV_LENGTH]
    tag = buf[1 + IV_LENGTH : 1 + IV_LENGTH + TAG_LENGTH]
    ct = buf[1 + IV_LENGTH + TAG_LENGTH :]
    aes = AESGCM(_load_key())
    plain = aes.decrypt(iv, ct + tag, None)
    return plain.decode("utf-8")
