"use client";

import { create } from "zustand";
import type { AnnotationColor, PdfAnnotation } from "@/lib/pdf/edit";

export type EditorToolMode =
  | "select"
  | "text"
  | "draw"
  | "rect"
  | "line";

interface EditPdfStoreState {
  annotations: PdfAnnotation[];
  past: PdfAnnotation[][];
  future: PdfAnnotation[][];
  selectedId: string | null;
  activeTool: EditorToolMode;
  activeColor: AnnotationColor;
  fontSize: number;
  strokeWidth: number;

  setActiveTool: (tool: EditorToolMode) => void;
  setActiveColor: (color: AnnotationColor) => void;
  setFontSize: (size: number) => void;
  setStrokeWidth: (width: number) => void;
  setSelectedId: (id: string | null) => void;

  addAnnotation: (ann: PdfAnnotation) => void;
  updateAnnotation: (
    id: string,
    updater: (prev: PdfAnnotation) => PdfAnnotation,
    recordHistory?: boolean
  ) => void;
  commitSnapshot: (previous: PdfAnnotation[]) => void;
  deleteAnnotation: (id: string) => void;
  undo: () => void;
  redo: () => void;
  resetAll: () => void;
}

export const useEditPdfStore = create<EditPdfStoreState>((set) => ({
  annotations: [],
  past: [],
  future: [],
  selectedId: null,
  activeTool: "select",
  activeColor: "#09090B",
  fontSize: 16,
  strokeWidth: 2,

  setActiveTool: (activeTool) => set({ activeTool }),
  setActiveColor: (activeColor) => set({ activeColor }),
  setFontSize: (fontSize) => set({ fontSize }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
  setSelectedId: (selectedId) => set({ selectedId }),

  addAnnotation: (ann) =>
    set((state) => ({
      past: [...state.past.slice(-39), state.annotations],
      annotations: [...state.annotations, ann],
      future: [],
      selectedId: ann.id,
    })),

  updateAnnotation: (id, updater, recordHistory = false) =>
    set((state) => ({
      past: recordHistory
        ? [...state.past.slice(-39), state.annotations]
        : state.past,
      annotations: state.annotations.map((item) =>
        item.id === id ? updater(item) : item
      ),
      future: recordHistory ? [] : state.future,
    })),

  commitSnapshot: (previous) =>
    set((state) => ({
      past: [...state.past.slice(-39), previous],
      future: [],
    })),

  deleteAnnotation: (id) =>
    set((state) => ({
      past: [...state.past.slice(-39), state.annotations],
      annotations: state.annotations.filter((item) => item.id !== id),
      future: [],
      selectedId: state.selectedId === id ? null : state.selectedId,
    })),

  undo: () =>
    set((state) => {
      if (state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1];
      return {
        annotations: prev,
        past: state.past.slice(0, -1),
        future: [state.annotations, ...state.future.slice(0, 39)],
        selectedId: null,
      };
    }),

  redo: () =>
    set((state) => {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        annotations: next,
        past: [...state.past.slice(-39), state.annotations],
        future: state.future.slice(1),
        selectedId: null,
      };
    }),

  resetAll: () =>
    set({
      annotations: [],
      past: [],
      future: [],
      selectedId: null,
      activeTool: "select",
    }),
}));
