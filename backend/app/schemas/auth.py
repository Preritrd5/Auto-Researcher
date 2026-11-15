from __future__ import annotations

import re
from datetime import datetime
from pydantic import BaseModel, Field, field_validator

from app.schemas.common import ORMModel

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


class UserRegister(BaseModel):
    name: str = Field(min_length=2, max_length=160, description="Full name or researcher handle")
    email: str = Field(min_length=3, max_length=255, description="Valid email address")
    password: str = Field(min_length=8, max_length=128, description="Password (at least 8 characters, letters and digits)")
    confirm_password: str | None = Field(default=None, description="Password confirmation")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        trimmed = v.strip()
        if len(trimmed) < 2:
            raise ValueError("Name must be at least 2 characters long")
        return trimmed

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        trimmed = v.strip().lower()
        if not EMAIL_REGEX.match(trimmed):
            raise ValueError("Invalid email format")
        return trimmed

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        has_letter = any(c.isalpha() for c in v)
        has_digit = any(c.isdigit() or not c.isalnum() for c in v)
        if not (has_letter and has_digit):
            raise ValueError("Password must contain at least one letter and one number or special character")
        return v


class UserLogin(BaseModel):
    email: str
    password: str
    remember_me: bool = False


class UserRead(ORMModel):
    id: str
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class LogoutResponse(BaseModel):
    detail: str = "Logged out successfully"


class MessageResponse(BaseModel):
    detail: str
