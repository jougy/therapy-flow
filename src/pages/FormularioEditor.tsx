import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, Loader2, Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  FormEditorBatchActionBar,
  FormEditorCanvas,
  FormEditorDraftRestoreDialog,
  FormEditorHeader,
  FormEditorInspectorPanel,
  FormEditorMobileDock,
  FormEditorPaletteSidebar,
  useFormEditorState,
} from "@/components/anamnesis-editor";

const FormularioEditor = () => {
  const state = useFormEditorState();

  if (state.loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 pb-36 max-w-full overflow-x-clip lg:pb-12"
      onClick={state.handleCanvasBackgroundClick}
    >
      <input
        ref={state.templateImportInputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(event) => void state.handleImportDraftModel(event)}
      />

      <FormEditorHeader state={state} />

      <FormEditorDraftRestoreDialog state={state} />

      {/* Main 3-Column Desktop Layout */}
      <div className="space-y-6 max-w-full lg:relative">
        {/* Left Column: Component Palette */}
        <div
          className={`hidden lg:block ${state.flowSidebarCollapsed ? "lg:w-[64px]" : "lg:w-[284px]"}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className={`fixed left-6 z-20 flex flex-col ${state.flowSidebarCollapsed ? "w-[56px]" : "w-[284px]"}`}
            style={{
              top: `${state.desktopMenuTop}px`,
              height: `${state.desktopMenuMaxHeight}px`,
              maxHeight: `${state.desktopMenuMaxHeight}px`,
            }}
          >
            <FormEditorPaletteSidebar
              flowSidebarCollapsed={state.flowSidebarCollapsed}
              setFlowSidebarCollapsed={state.setFlowSidebarCollapsed}
              handleAddField={state.handleAddField}
              setDraggedNewFieldType={state.setDraggedNewFieldType}
              isBase={state.isBase}
            />
          </div>
        </div>

        {/* Right Column: Unified Flow & Inspector */}
        <div className="hidden lg:block lg:w-[332px]" onClick={(e) => e.stopPropagation()}>
          <div
            className="fixed right-6 z-20 flex flex-col w-[332px] space-y-3"
            style={{
              top: `${state.desktopMenuTop}px`,
              height: `${state.desktopMenuMaxHeight}px`,
              maxHeight: `${state.desktopMenuMaxHeight}px`,
            }}
          >
            <div className="flex-1 min-h-0 flex flex-col">
              <FormEditorInspectorPanel state={state} />
            </div>
            <div data-tutorial="form-editor-actions" className="shrink-0 rounded-lg border bg-card p-3 shadow-xs space-y-2">
              <Button
                type="button"
                data-tutorial="form-editor-save-btn"
                className="w-full h-10 shadow-sm"
                onClick={() => void state.handleSave()}
                disabled={state.saving || !state.templateName.trim() || (!state.isDirty && !state.isNew)}
              >
                {state.saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar ficha
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full text-xs"
                onClick={() => state.templateImportInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5 mr-2" />
                Importar arquivo
              </Button>
              <Button
                asChild
                type="button"
                variant="ghost"
                className="w-full text-xs text-muted-foreground hover:text-foreground"
              >
                <Link to={`${state.clinicBasePath}/configuracoes/formularios/biblioteca`}>
                  <BookOpen className="h-3.5 w-3.5 mr-2 text-primary" />
                  Biblioteca de Modelos
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Center Column: Canvas */}
        <FormEditorCanvas state={state} />
      </div>

      {/* Floating Save Button */}
      {state.showFloatingSave && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] right-3 z-50 hidden sm:block lg:hidden sm:bottom-5 sm:right-5">
          <Button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void state.handleSave();
            }}
            disabled={state.saving || !state.templateName.trim() || (!state.isDirty && !state.isNew)}
            className="h-11 rounded-full px-5 shadow-lg shadow-primary/20"
            aria-label="Salvar ficha pelo botão fixo"
          >
            {state.saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar ficha
          </Button>
        </div>
      )}

      {/* Batch Actions Bar */}
      <FormEditorBatchActionBar
        isMultiSelecting={state.isMultiSelecting}
        selectedFieldIds={state.selectedFieldIds}
        isAllSelected={state.isAllSelected}
        handleToggleSelectAll={state.handleToggleSelectAll}
        encapsulateSelectedFields={state.encapsulateSelectedFields}
        duplicateSelectedFields={state.duplicateSelectedFields}
        deleteSelectedFields={state.deleteSelectedFields}
        setSelectedFieldIds={state.setSelectedFieldIds}
      />

      {/* Mobile Navigation Dock */}
      <FormEditorMobileDock
        saving={state.saving}
        templateName={state.templateName}
        mobileMenuOpen={state.mobileMenuOpen}
        setMobileMenuOpen={state.setMobileMenuOpen}
        mobileInspectorOpen={state.mobileInspectorOpen}
        setMobileInspectorOpen={state.setMobileInspectorOpen}
        selectedFieldId={state.selectedFieldId}
        handleSave={state.handleSave}
        onImportClick={() => state.templateImportInputRef.current?.click()}
      />

      {/* Mobile Drawer 1: Component Library */}
      <Sheet
        open={state.mobileMenuOpen}
        onOpenChange={(open) => {
          if (!open && typeof document !== "undefined" && document.querySelector("[data-radix-popper-content-wrapper]")) {
            return;
          }
          state.setMobileMenuOpen(open);
        }}
      >
        <SheetContent
          side="left"
          className="w-[320px] max-w-[85vw] p-3 overflow-y-auto max-h-[100dvh]"
          onClick={(e) => e.stopPropagation()}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Biblioteca de componentes</SheetTitle>
          </SheetHeader>
          <FormEditorPaletteSidebar
            flowSidebarCollapsed={false}
            setFlowSidebarCollapsed={() => {}}
            handleAddField={(type) => {
              state.handleAddField(type);
              state.setMobileMenuOpen(false);
            }}
            setDraggedNewFieldType={state.setDraggedNewFieldType}
            isBase={state.isBase}
          />
        </SheetContent>
      </Sheet>

      {/* Mobile Drawer 2: Fluxo / Inspetor */}
      <Sheet
        open={state.mobileInspectorOpen}
        onOpenChange={(open) => {
          if (!open && typeof document !== "undefined" && document.querySelector("[data-radix-popper-content-wrapper]")) {
            return;
          }
          state.setMobileInspectorOpen(open);
        }}
      >
        <SheetContent
          side="right"
          className="w-[340px] max-w-[90vw] p-3 overflow-y-auto max-h-[100dvh] space-y-3 pb-28"
          onClick={(e) => e.stopPropagation()}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Fluxo e propriedades da ficha</SheetTitle>
          </SheetHeader>
          <FormEditorInspectorPanel state={state} />
          <div className="rounded-lg border bg-card p-3 shadow-xs space-y-2">
            <Button
              type="button"
              className="w-full h-10 shadow-sm"
              onClick={() => {
                void state.handleSave();
                state.setMobileInspectorOpen(false);
              }}
              disabled={state.saving || !state.templateName.trim() || (!state.isDirty && !state.isNew)}
            >
              {state.saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar ficha
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full text-xs"
              onClick={() => {
                state.templateImportInputRef.current?.click();
                state.setMobileInspectorOpen(false);
              }}
            >
              <Upload className="h-3.5 w-3.5 mr-2" />
              Importar modelo
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </motion.div>
  );
};

export default FormularioEditor;
