'use client';

import { AppError } from './system';

/** A screen of the employee app crashed while rendering: the design's "Something went wrong". */
export default function EmployeeAppError({ error, reset }: { error: Error; reset: () => void }) {
  return <AppError error={error} retry={reset} />;
}
