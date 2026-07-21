"""Serializers de la API núcleo."""

from django.contrib.auth.models import Group, Permission
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Branch, BranchUser, CompanySetting, User
from .permissions import ALL_CODENAMES, user_permission_codenames


class CompanySettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanySetting
        exclude = ["created_at", "updated_at"]


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ["id", "name", "code", "address", "phone", "email", "is_main", "active"]


class UserSerializer(serializers.ModelSerializer):
    """Perfil del usuario autenticado (para /auth/me/)."""

    roles = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "name", "email", "is_staff", "is_superuser", "is_device", "roles", "permissions"]

    def get_roles(self, obj):
        return list(obj.groups.values_list("name", flat=True))

    def get_permissions(self, obj):
        return sorted(user_permission_codenames(obj))


# ---------------------------------------------------------------------------
# Gestión de usuarios
# ---------------------------------------------------------------------------

class UserBranchSerializer(serializers.Serializer):
    branch_id = serializers.IntegerField()
    is_default = serializers.BooleanField(default=False)


class UserAdminSerializer(serializers.ModelSerializer):
    roles = serializers.SerializerMethodField()
    branches = serializers.SerializerMethodField()
    has_pin = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "name", "username", "email", "is_active", "is_device", "has_pin", "roles", "branches"]

    def get_has_pin(self, obj):
        return bool(obj.pin_hash)

    def get_roles(self, obj):
        return list(obj.groups.values_list("name", flat=True))

    def get_branches(self, obj):
        return [
            {"branch_id": link.branch_id, "name": link.branch.name, "is_default": link.is_default}
            for link in obj.branch_links.select_related("branch")
        ]


class UserWriteSerializer(serializers.ModelSerializer):
    username = serializers.CharField(required=False, allow_blank=True)  # se autocompleta con el email
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    pin = serializers.CharField(write_only=True, required=False, allow_blank=True)  # PIN numérico (opcional)
    has_pin = serializers.SerializerMethodField()
    role = serializers.CharField(required=False, allow_blank=True)  # un rol (nombre de grupo)
    branches = UserBranchSerializer(many=True, required=False)

    class Meta:
        model = User
        fields = ["id", "name", "username", "email", "is_active", "is_device", "password", "pin", "has_pin", "role", "branches"]

    def get_has_pin(self, obj):
        return bool(obj.pin_hash)

    def validate_pin(self, value):
        if value and (not value.isdigit() or not (4 <= len(value) <= 6)):
            raise serializers.ValidationError("El PIN debe ser de 4 a 6 dígitos.")
        return value

    def validate_email(self, value):
        qs = User.objects.filter(email__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Ya existe un usuario con ese correo.")
        return value

    def validate_password(self, value):
        if value:
            validate_password(value)
        return value

    def validate_role(self, value):
        if value and not Group.objects.filter(name=value).exists():
            raise serializers.ValidationError("Rol inexistente.")
        return value

    def _apply_relations(self, user, role, branches):
        if role is not None:
            user.groups.set(Group.objects.filter(name=role)) if role else user.groups.clear()
        if branches is not None:
            user.branch_links.all().delete()
            for b in branches:
                BranchUser.objects.create(
                    user=user, branch_id=b["branch_id"], is_default=b.get("is_default", False)
                )

    def create(self, validated_data):
        password = validated_data.pop("password", "") or None
        pin = validated_data.pop("pin", None)
        role = validated_data.pop("role", None)
        branches = validated_data.pop("branches", None)
        if not validated_data.get("username"):
            validated_data["username"] = validated_data["email"]
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        if pin is not None:
            user.set_pin(pin)
        user.save()
        self._apply_relations(user, role, branches)
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", "") or None
        pin = validated_data.pop("pin", None)
        role = validated_data.pop("role", None)
        branches = validated_data.pop("branches", None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        if password:
            instance.set_password(password)
        if pin is not None:
            instance.set_pin(pin)  # "" borra el PIN
        instance.save()
        self._apply_relations(instance, role, branches)
        return instance


# ---------------------------------------------------------------------------
# Roles (grupos) y permisos
# ---------------------------------------------------------------------------

class RoleSerializer(serializers.ModelSerializer):
    permissions = serializers.SerializerMethodField()
    user_count = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = ["id", "name", "permissions", "user_count"]

    def get_permissions(self, obj):
        return sorted(set(obj.permissions.values_list("codename", flat=True)) & set(ALL_CODENAMES))

    def get_user_count(self, obj):
        return obj.user_set.count()


PROTECTED_ROLES = {"admin", "vendedor", "almacenista"}


class RoleWriteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=60)
    permissions = serializers.ListField(child=serializers.CharField(), required=False, default=list)

    def validate_permissions(self, value):
        invalid = set(value) - set(ALL_CODENAMES)
        if invalid:
            raise serializers.ValidationError(f"Permisos inexistentes: {', '.join(invalid)}")
        return value
