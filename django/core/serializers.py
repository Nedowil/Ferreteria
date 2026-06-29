"""Serializers de la API núcleo."""

from rest_framework import serializers

from .models import Branch, User


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ["id", "name", "code", "address", "phone", "email", "is_main", "active"]


class UserSerializer(serializers.ModelSerializer):
    roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "name", "email", "is_staff", "is_superuser", "roles"]

    def get_roles(self, obj):
        return list(obj.groups.values_list("name", flat=True))
