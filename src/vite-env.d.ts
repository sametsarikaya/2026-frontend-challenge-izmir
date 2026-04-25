/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_JOTFORM_KEYS: string
  readonly VITE_FORM_CHECKINS: string
  readonly VITE_FORM_MESSAGES: string
  readonly VITE_FORM_SIGHTINGS: string
  readonly VITE_FORM_NOTES: string
  readonly VITE_FORM_TIPS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
