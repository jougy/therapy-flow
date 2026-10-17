import {
  ANAMNESIS_SCHEMA_FIELD_LIMIT,
  createAnamnesisField,
  isContainerField,
  type AnamnesisField,
} from "@/lib/anamnesis-forms";
import {
  castDesignLabSchema,
  cloneFieldWithNewIds,
  flattenLayoutItems,
  type DesignLabAnamnesisField,
  type DesignLabTemplateLayoutItem,
  type DesignLabTemplateSchema,
} from "../types";
import type { DuplicateFieldResult, EncapsulateContainerType } from "./types";

export function isFieldConditionallyVisible(
  field: AnamnesisField,
  templateFields: DesignLabTemplateSchema,
  testAnswers: Record<string, unknown>
): boolean {
  if (field.groupKey) {
    const parent = templateFields.find((f) => f.id === field.groupKey);
    if (parent && parent.type === "section_selector") {
      const switchStates = (testAnswers[parent.id] as Record<string, boolean>) ?? {};
      return switchStates[field.id] ?? true;
    }
    if (parent && parent.groupKey) {
      const grandParent = templateFields.find((f) => f.id === parent.groupKey);
      if (grandParent && grandParent.type === "section_selector") {
        const switchStates = (testAnswers[grandParent.id] as Record<string, boolean>) ?? {};
        return switchStates[parent.id] ?? true;
      }
    }
  }

  if (field.sectionKey) {
    const selectorField = templateFields.find((f) => f.type === "section_selector");
    if (selectorField) {
      const switchStates = (testAnswers[selectorField.id] as Record<string, boolean>) ?? {};
      return !!switchStates[field.sectionKey];
    }
  }

  return true;
}

export function moveFieldInTree(
  fields: DesignLabTemplateSchema,
  groupedLayout: DesignLabTemplateLayoutItem[],
  fieldId: string,
  direction: -1 | 1
): DesignLabTemplateSchema {
  const visualFields = flattenLayoutItems(groupedLayout);
  const currIdx = visualFields.findIndex((f) => f.id === fieldId);
  if (currIdx === -1) return fields;

  const targetIdx = currIdx + direction;
  if (targetIdx < 0 || targetIdx >= visualFields.length) return fields;

  const adjacentField = visualFields[targetIdx];
  const next = [...fields];
  const fieldIndex = next.findIndex((f) => f.id === fieldId);
  if (fieldIndex === -1) return fields;

  const fieldToMove = next[fieldIndex];
  const isContainer = isContainerField(fieldToMove);

  if (isContainer) {
    const blockIds = new Set<string>();
    blockIds.add(fieldId);
    next.forEach((f) => {
      if (f.groupKey === fieldId) blockIds.add(f.id);
    });

    let nextAdjacentIdx = targetIdx;
    while (
      nextAdjacentIdx >= 0 &&
      nextAdjacentIdx < visualFields.length &&
      blockIds.has(visualFields[nextAdjacentIdx].id)
    ) {
      nextAdjacentIdx += direction;
    }

    if (nextAdjacentIdx < 0 || nextAdjacentIdx >= visualFields.length) return fields;
    const targetRefField = visualFields[nextAdjacentIdx];

    const blockItems = next.filter((f) => blockIds.has(f.id));
    const remainingItems = next.filter((f) => !blockIds.has(f.id));

    const refIndexInRemaining = remainingItems.findIndex((f) => f.id === targetRefField.id);
    if (refIndexInRemaining === -1) return fields;

    const insertAt = direction === -1 ? refIndexInRemaining : refIndexInRemaining + 1;
    remainingItems.splice(insertAt, 0, ...blockItems);
    return castDesignLabSchema(remainingItems);
  } else {
    let newGroupKey: string | null = fieldToMove.groupKey ?? null;

    if (direction === -1) {
      if (fieldToMove.groupKey) {
        const parentSection = fields.find((f) => f.id === fieldToMove.groupKey);
        const sectionChildren = visualFields.filter((f) => f.groupKey === fieldToMove.groupKey);
        const isFirstChild = sectionChildren[0]?.id === fieldId;

        if (isFirstChild && parentSection) {
          newGroupKey = parentSection.groupKey ?? null;
        } else if (adjacentField) {
          newGroupKey = adjacentField.groupKey ?? fieldToMove.groupKey;
        }
      } else {
        if (isContainerField(adjacentField)) {
          newGroupKey = adjacentField.id;
        } else {
          newGroupKey = adjacentField.groupKey ?? null;
        }
      }
    } else {
      if (fieldToMove.groupKey) {
        const sectionChildren = visualFields.filter((f) => f.groupKey === fieldToMove.groupKey);
        const isLastChild = sectionChildren[sectionChildren.length - 1]?.id === fieldId;

        if (isLastChild) {
          const parentSection = fields.find((f) => f.id === fieldToMove.groupKey);
          newGroupKey = parentSection?.groupKey ?? null;
        } else if (adjacentField) {
          newGroupKey = isContainerField(adjacentField)
            ? adjacentField.id
            : (adjacentField.groupKey ?? fieldToMove.groupKey);
        }
      } else {
        if (isContainerField(adjacentField)) {
          newGroupKey = adjacentField.id;
        } else {
          newGroupKey = adjacentField.groupKey ?? null;
        }
      }
    }

    const updatedField = { ...fieldToMove, groupKey: newGroupKey };
    const remaining = next.filter((f) => f.id !== fieldId);
    const refIndex = remaining.findIndex((f) => f.id === adjacentField.id);

    if (refIndex === -1) {
      remaining.push(updatedField);
    } else {
      const insertAt = direction === -1 ? refIndex : refIndex + 1;
      remaining.splice(insertAt, 0, updatedField);
    }

    return castDesignLabSchema(remaining);
  }
}

export function handleFluxoDrop(
  fields: DesignLabTemplateSchema,
  selectedFieldIds: string[],
  draggedId: string,
  targetId: string,
  position: "before" | "inside" | "after"
): DesignLabTemplateSchema {
  if (draggedId === targetId) return fields;
  const targetField = fields.find((f) => f.id === targetId);
  if (!targetField) return fields;

  const isMultiDrag = selectedFieldIds.length > 1 && selectedFieldIds.includes(draggedId);
  const rootDraggedIds = isMultiDrag ? selectedFieldIds : [draggedId];

  const blockIds = new Set<string>();

  const collectDescendants = (parentId: string) => {
    fields.forEach((child) => {
      if (child.groupKey === parentId) {
        if (!blockIds.has(child.id)) {
          blockIds.add(child.id);
          if (isContainerField(child)) {
            collectDescendants(child.id);
          }
        }
      }
    });
  };

  rootDraggedIds.forEach((id) => {
    blockIds.add(id);
    const f = fields.find((item) => item.id === id);
    if (f && isContainerField(f)) {
      collectDescendants(id);
    }
  });

  if (blockIds.has(targetId)) return fields;

  let newGroupKey: string | null = targetField.groupKey ?? null;
  if (position === "inside" && isContainerField(targetField)) {
    newGroupKey = targetField.id;
  }

  const itemsToMove = fields
    .filter((f) => blockIds.has(f.id))
    .map((f) => (rootDraggedIds.includes(f.id) ? { ...f, groupKey: newGroupKey } : f));
  const remaining = fields.filter((f) => !blockIds.has(f.id));

  const refIndex = remaining.findIndex((f) => f.id === targetId);
  if (refIndex === -1) {
    remaining.push(...itemsToMove);
  } else {
    let insertIndex = refIndex;
    if (position === "before") {
      insertIndex = refIndex;
    } else if (position === "inside" && isContainerField(targetField)) {
      insertIndex = refIndex + 1;
    } else {
      if (isContainerField(targetField)) {
        let lastChildIdx = refIndex;
        for (let i = refIndex + 1; i < remaining.length; i++) {
          if (remaining[i].groupKey === targetField.id) {
            lastChildIdx = i;
          }
        }
        insertIndex = lastChildIdx + 1;
      } else {
        insertIndex = refIndex + 1;
      }
    }
    remaining.splice(insertIndex, 0, ...itemsToMove);
  }

  return castDesignLabSchema(remaining);
}

export function duplicateFieldLogic(
  fields: DesignLabTemplateSchema,
  field: DesignLabAnamnesisField
): { success: true; result: DuplicateFieldResult } | { success: false; error: string } {
  const isContainer = isContainerField(field);
  const children = isContainer ? fields.filter((f) => f.groupKey === field.id) : [];
  const fieldsToAddCount = 1 + children.length;

  if (fields.length + fieldsToAddCount > ANAMNESIS_SCHEMA_FIELD_LIMIT) {
    return {
      success: false,
      error: `Esta duplicação ultrapassaria o limite máximo de ${ANAMNESIS_SCHEMA_FIELD_LIMIT} campos por ficha.`,
    };
  }

  const duplicatedParent = cloneFieldWithNewIds(field, field.groupKey ?? null, fields.length + 1);
  const duplicatedChildren = children.map((child, childIdx) =>
    cloneFieldWithNewIds(child, duplicatedParent.id, fields.length + 2 + childIdx)
  );

  const parentIndex = fields.findIndex((f) => f.id === field.id);
  if (parentIndex === -1) {
    return {
      success: true,
      result: {
        nextFields: castDesignLabSchema([...fields, duplicatedParent, ...duplicatedChildren]),
        duplicatedParent,
        childrenCount: children.length,
      },
    };
  }

  const next = [...fields];
  let insertIndex = parentIndex + 1;
  if (isContainer) {
    for (let i = parentIndex + 1; i < next.length; i++) {
      if (next[i].groupKey === field.id) {
        insertIndex = i + 1;
      }
    }
  }

  next.splice(insertIndex, 0, duplicatedParent, ...duplicatedChildren);
  return {
    success: true,
    result: {
      nextFields: castDesignLabSchema(next),
      duplicatedParent,
      childrenCount: children.length,
    },
  };
}

export function duplicateSelectedFieldsLogic(
  fields: DesignLabTemplateSchema,
  selectedFieldIds: string[]
): { success: true; nextFields: DesignLabTemplateSchema; newFieldIds: string[]; topLevelCount: number } | { success: false; error: string } | null {
  if (selectedFieldIds.length === 0) return null;

  const topLevelSelected = fields.filter((f) => selectedFieldIds.includes(f.id));
  if (topLevelSelected.length === 0) return null;

  let totalAdded = 0;
  topLevelSelected.forEach((f) => {
    totalAdded += 1;
    if (isContainerField(f)) {
      totalAdded += fields.filter((c) => c.groupKey === f.id).length;
    }
  });

  if (fields.length + totalAdded > ANAMNESIS_SCHEMA_FIELD_LIMIT) {
    return {
      success: false,
      error: `Esta duplicação em massa ultrapassaria o limite de ${ANAMNESIS_SCHEMA_FIELD_LIMIT} campos.`,
    };
  }

  const newFieldIds: string[] = [];
  const fieldsToInsert: DesignLabAnamnesisField[] = [];

  topLevelSelected.forEach((field, idx) => {
    const isContainer = isContainerField(field);
    const children = isContainer ? fields.filter((f) => f.groupKey === field.id) : [];
    const duplicatedParent = cloneFieldWithNewIds(field, field.groupKey ?? null, fields.length + idx * 10 + 1);
    newFieldIds.push(duplicatedParent.id);
    fieldsToInsert.push(duplicatedParent);

    children.forEach((child, cIdx) => {
      const duplicatedChild = cloneFieldWithNewIds(
        child,
        duplicatedParent.id,
        fields.length + idx * 10 + cIdx + 2
      );
      fieldsToInsert.push(duplicatedChild);
    });
  });

  return {
    success: true,
    nextFields: castDesignLabSchema([...fields, ...fieldsToInsert]),
    newFieldIds,
    topLevelCount: topLevelSelected.length,
  };
}

export function encapsulateSelectedFieldsLogic(
  fields: DesignLabTemplateSchema,
  selectedFieldIds: string[],
  containerType: EncapsulateContainerType
): { success: true; nextFields: DesignLabTemplateSchema; newContainer: DesignLabAnamnesisField } | { success: false; error: string } | null {
  if (selectedFieldIds.length === 0) return null;

  if (fields.length + 1 > ANAMNESIS_SCHEMA_FIELD_LIMIT) {
    return {
      success: false,
      error: `Não é possível adicionar uma nova seção pois o limite de ${ANAMNESIS_SCHEMA_FIELD_LIMIT} campos foi atingido.`,
    };
  }

  const newContainer = createAnamnesisField(containerType, fields.length + 1) as DesignLabAnamnesisField;
  newContainer.label =
    containerType === "radar_section"
      ? "Polígono de Status"
      : containerType === "section"
        ? "Nova Seção Agrupada"
        : "Nova Seção Horizontal";

  const firstSelectedIndex = fields.findIndex((f) => selectedFieldIds.includes(f.id));
  const targetGroupKey = firstSelectedIndex >= 0 ? fields[firstSelectedIndex].groupKey : null;
  newContainer.groupKey = targetGroupKey;

  const next = fields.map((f) => {
    if (selectedFieldIds.includes(f.id)) {
      return { ...f, groupKey: newContainer.id };
    }
    return f;
  });

  const insertPos = firstSelectedIndex >= 0 ? firstSelectedIndex : next.length;
  next.splice(insertPos, 0, newContainer);

  return {
    success: true,
    nextFields: castDesignLabSchema(next),
    newContainer,
  };
}

export function deleteSelectedFieldsLogic(
  fields: DesignLabTemplateSchema,
  selectedFieldIds: string[]
): { nextFields: DesignLabTemplateSchema; count: number } {
  if (selectedFieldIds.length === 0) {
    return { nextFields: fields, count: 0 };
  }

  const count = selectedFieldIds.length;
  const idsToDelete = new Set<string>(selectedFieldIds);
  fields.forEach((f) => {
    if (f.groupKey && idsToDelete.has(f.groupKey)) {
      idsToDelete.add(f.id);
    }
  });

  return {
    nextFields: castDesignLabSchema(fields.filter((f) => !idsToDelete.has(f.id))),
    count,
  };
}

export function deleteSectionAndFieldsLogic(
  fields: DesignLabTemplateSchema,
  sectionId: string
): DesignLabTemplateSchema {
  return castDesignLabSchema(fields.filter((f) => f.id !== sectionId && f.groupKey !== sectionId));
}

export function moveFieldsAndDeleteSectionLogic(
  fields: DesignLabTemplateSchema,
  sectionId: string,
  targetSectionId: string | null
): DesignLabTemplateSchema {
  return castDesignLabSchema(
    fields
      .filter((f) => f.id !== sectionId)
      .map((f) => {
        if (f.groupKey !== sectionId) return f;
        return { ...f, groupKey: targetSectionId };
      })
  );
}

export function createAndInsertFieldLogic(
  fields: DesignLabTemplateSchema,
  type: AnamnesisField["type"],
  selectedFieldId: string | null,
  customTargetGroupKey?: string | null
): { success: true; nextFields: DesignLabTemplateSchema; createdField: DesignLabAnamnesisField } | { success: false; error: string } {
  if (fields.length >= ANAMNESIS_SCHEMA_FIELD_LIMIT) {
    return {
      success: false,
      error: `Uma ficha pode ter no máximo ${ANAMNESIS_SCHEMA_FIELD_LIMIT} campos.`,
    };
  }

  const newField = createAnamnesisField(type, fields.length + 1) as DesignLabAnamnesisField;
  let targetGroupKey: string | null = customTargetGroupKey !== undefined ? customTargetGroupKey : null;
  let insertIndex = fields.length;

  if (customTargetGroupKey === undefined && selectedFieldId) {
    const selectedIndex = fields.findIndex((f) => f.id === selectedFieldId);
    if (selectedIndex !== -1) {
      const selField = fields[selectedIndex];
      const isSelectedContainer = isContainerField(selField);

      if (isSelectedContainer) {
        targetGroupKey = selField.id;
        insertIndex = selectedIndex + 1;
      } else {
        targetGroupKey = selField.groupKey ?? null;
        insertIndex = selectedIndex + 1;
      }
    }
  }

  const fieldToInsert = { ...newField, groupKey: targetGroupKey };
  const next = [...fields];
  next.splice(insertIndex, 0, fieldToInsert);

  return {
    success: true,
    nextFields: castDesignLabSchema(next),
    createdField: fieldToInsert,
  };
}

export function insertNewFieldAtTargetLogic(
  fields: DesignLabTemplateSchema,
  newFieldType: AnamnesisField["type"],
  targetId: string,
  position: "before" | "inside" | "after"
): { success: true; nextFields: DesignLabTemplateSchema; createdField: DesignLabAnamnesisField } | { success: false; error: string } {
  if (fields.length >= ANAMNESIS_SCHEMA_FIELD_LIMIT) {
    return {
      success: false,
      error: `Uma ficha pode ter no máximo ${ANAMNESIS_SCHEMA_FIELD_LIMIT} campos.`,
    };
  }

  const newField = createAnamnesisField(newFieldType, fields.length + 1) as DesignLabAnamnesisField;
  const targetField = fields.find((f) => f.id === targetId);

  if (!targetField) {
    return {
      success: true,
      nextFields: castDesignLabSchema([...fields, newField]),
      createdField: newField,
    };
  }

  const next = [...fields];
  const targetIdx = next.findIndex((f) => f.id === targetId);
  if (targetIdx === -1) {
    return {
      success: true,
      nextFields: castDesignLabSchema([...next, newField]),
      createdField: newField,
    };
  }

  if (position === "inside" && isContainerField(targetField)) {
    newField.groupKey = targetField.id;
    next.splice(targetIdx + 1, 0, newField);
  } else if (position === "before") {
    newField.groupKey = targetField.groupKey ?? null;
    next.splice(targetIdx, 0, newField);
  } else {
    newField.groupKey = targetField.groupKey ?? null;
    if (isContainerField(targetField)) {
      let lastChildIdx = targetIdx;
      for (let i = targetIdx + 1; i < next.length; i++) {
        if (next[i].groupKey === targetField.id) {
          lastChildIdx = i;
        }
      }
      next.splice(lastChildIdx + 1, 0, newField);
    } else {
      next.splice(targetIdx + 1, 0, newField);
    }
  }

  return {
    success: true,
    nextFields: castDesignLabSchema(next),
    createdField: newField,
  };
}
