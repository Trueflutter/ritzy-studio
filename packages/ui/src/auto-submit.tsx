"use client";

import { useEffect, useRef } from "react";

type AutoSubmitProps = {
  formId: string;
};

export function AutoSubmit({ formId }: AutoSubmitProps) {
  const submittedRef = useRef(false);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (submittedRef.current) {
        return;
      }

      const form = document.getElementById(formId);
      if (form instanceof HTMLFormElement) {
        submittedRef.current = true;
        form.requestSubmit();
      }
    }, 200);

    return () => {
      window.clearTimeout(handle);
    };
  }, [formId]);

  return null;
}
