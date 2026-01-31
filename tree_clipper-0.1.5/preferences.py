import bpy


class TreeClipperPreferences(bpy.types.AddonPreferences):
    bl_idname = __package__

    max_clipboard_megabyte: bpy.props.IntProperty(
        name="Max. Clipboard Size (MB)",
        description="""Maximum clipboard size in kilobytes (UTF-8 encoded).

The export fails (safely) if the limit is exceeded.
If this setting is beyond your system's capabilities,
Blender might crash on export.

The default value is somewhat conservative, but not guaranteed to be safe.""",
        default=10,
    )  # type: ignore

    show_advanced_options: bpy.props.BoolProperty(
        name="Show Advanced Options",
        default=False,
    )  # type: ignore

    def draw(self, context: bpy.types.Context) -> None:
        self.layout.prop(self, "max_clipboard_megabyte")
        self.layout.prop(self, "show_advanced_options")


def get_max_clipboard_bytes():
    return (
        1_000_000
        * bpy.context.preferences.addons.get(  # ty:ignore[possibly-missing-attribute]
            __package__  # ty:ignore[invalid-argument-type]
        ).preferences.max_clipboard_megabyte
    )  # ty:ignore[possibly-missing-attribute]


def get_show_advanced_options():
    return bpy.context.preferences.addons.get(  # ty:ignore[possibly-missing-attribute]
        __package__  # ty:ignore[invalid-argument-type]
    ).preferences.show_advanced_options  # ty:ignore[possibly-missing-attribute]
