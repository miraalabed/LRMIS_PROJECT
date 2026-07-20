export function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ERR_NETWORK') {
    return 'Cannot reach the backend at http://127.0.0.1:8000. Start the FastAPI server, then try again.';
  }

  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { detail?: unknown } } }).response;
    const detail = response?.data?.detail;

    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (typeof item === 'object' && item !== null && 'msg' in item) {
            const field = 'loc' in item && Array.isArray(item.loc) ? item.loc.join('.') : 'field';
            return `${field}: ${String(item.msg)}`;
          }
          return String(item);
        })
        .join('\n');
    }

    if (typeof detail === 'string') {
      return detail;
    }
  }

  if (error instanceof Error) {
    if (error.message === 'Network Error') {
      return 'Cannot reach the backend at http://127.0.0.1:8000. Start the FastAPI server, then try again.';
    }

    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

export function formatValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return 'Not provided';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}
