---
name: ui-mermaid-writer
description: Convert UI Node Tree & Notes Exporter v10.10+ handoff TXT into Mermaid sequenceDiagram while preserving real Figma node identities, independent component boundaries, whole-subtree ignore semantics, and exact Variant business-delta rules. Use when writing or reviewing UI control interaction diagrams from plugin exports.
---

# UI Mermaid Writer

Before producing or reviewing Mermaid output, read [SKILL_UI_Mermaid_Writer_v1.3.md](SKILL_UI_Mermaid_Writer_v1.3.md) completely and follow it as the operating procedure.

Read [UI控件交互图_Mermaid转写规范_v2.3.md](UI控件交互图_Mermaid转写规范_v2.3.md) when the task needs the full policy, edge-case definitions, or output examples. Treat that specification as authoritative when a brief instruction is ambiguous.

Do not reinterpret plugin-internal migration diagnostics as business meaning. Preserve every real node name exactly, and never infer a parent-child relationship merely from a linked-component association.
