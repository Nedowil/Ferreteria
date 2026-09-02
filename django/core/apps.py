from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "core"

    def ready(self):
        # Que TODOS los serializers de modelo redondeen los decimales que llegan
        # (en vez de fallar con números larguísimos de divisiones/fracciones).
        from django.db import models
        from rest_framework import serializers
        from .serializer_fields import RoundingDecimalField

        serializers.ModelSerializer.serializer_field_mapping[models.DecimalField] = RoundingDecimalField
