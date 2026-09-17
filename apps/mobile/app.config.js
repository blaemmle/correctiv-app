// app.json holds the config; this file adds the one value that cannot be static.
//
// GitHub Pages serves this app from https://correctiv.github.io/correctiv-app/,
// not from a domain root. A default export writes absolute URLs — `/_expo/...`,
// `/assets/...` — which resolve to correctiv.github.io/_expo/... there and 404,
// giving a blank page from a green build. `experiments.baseUrl` prefixes them, and
// expo-router uses the same value for its own hrefs and history.
//
// It has to be conditional: the prefix is wrong everywhere else. `npm run web`,
// `serve-clean.mjs` and the native builds all serve from a root, so only the Pages
// workflow sets EXPO_BASE_URL.
//
// The dev server sets it too, in `package.json`'s `web` script, and to the same
// `/app` the deploy uses. The workbench frames the app one directory below itself
// in both modes, so a dev server serving from the root answered `/app/` with the
// app's own 404 screen: expo-router reads the browser's path, and without a base
// it has no route called `app`. The address to open the app on its own in
// development is therefore http://localhost:8081/app/ .
module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_BASE_URL?.trim();
  if (!baseUrl) return config;

  return {
    ...config,
    experiments: { ...config.experiments, baseUrl: baseUrl.replace(/\/+$/, '') },
  };
};
