from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Branch, BranchUser, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("email", "name", "is_staff", "is_active")
    ordering = ("email",)


admin.site.register(Branch)
admin.site.register(BranchUser)
