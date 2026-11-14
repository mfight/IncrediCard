// The component's own styles come with its modules, as they do in the
// Storybook; an app using the package imports incredicard/styles.css.
import "./site.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Landing } from "./Landing";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
);
