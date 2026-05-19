"use client";

import { useEffect, useRef } from "react";

type AutoSubmitProps = {
  formId: string;
};

export function AutoSubmit({ formId }: AutoSubmitProps) {
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current) {
      return;
    }
    submittedRef.current = true;

    const handle = window.setTimeout(() => {
      const form = document.getElementById(formId);
      if (form instanceof HTMLFormElement) {
        form.requestSubmit();
      }
    }, 200);

    return () => {
      window.clearTimeout(handle);
    };
  }, [formId]);

  return null;
}
