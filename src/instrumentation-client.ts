import { initBotId } from "botid/client/core";

initBotId({
  protect: [
    { path: "/", method: "POST" },
    { path: "/dashboard", method: "POST" },
    { path: "/dashboard/*", method: "POST" },
  ],
});
