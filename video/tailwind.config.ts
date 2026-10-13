// Reuses the app's Tailwind theme so the video can never drift from it.
// NODE_PATH (set in package.json scripts) lets the app config find its plugins in this folder.
import base from "../tailwind.config";

export default {
  ...base,
  content: [
    "./src/**/*.{ts,tsx}",
    "../client/src/components/ui/{button,badge,card,input,label,checkbox,table}.tsx",
  ],
};
