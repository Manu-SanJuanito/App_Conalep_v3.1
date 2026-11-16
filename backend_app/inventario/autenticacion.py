from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed


class TokenConExpiracion(TokenAuthentication):
    """Igual que TokenAuthentication, pero la sesión caduca a las TOKEN_HORAS."""

    def authenticate_credentials(self, key):
        usuario, token = super().authenticate_credentials(key)
        if timezone.now() - token.created > timedelta(hours=settings.TOKEN_HORAS):
            token.delete()
            raise AuthenticationFailed('Tu sesión expiró. Inicia sesión de nuevo.')
        return usuario, token
