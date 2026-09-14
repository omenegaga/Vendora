import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

import { attachSupabaseAuth } from "./integrations/supabase/auth-attacher";

export const startInstance = createStart(() => ({
  // Defining a Start instance disables Start's implicit CSRF middleware, so keep
  // server-function requests protected while registering the global auth header.
  requestMiddleware: [
    createCsrfMiddleware({
      filter: (context) => context.handlerType === "serverFn",
    }),
  ],
  functionMiddleware: [attachSupabaseAuth],
}));
