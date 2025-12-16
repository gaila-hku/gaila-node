const safeJsonParse = (jsonString: unknown) => {
  if (typeof jsonString !== 'string') {
    return jsonString;
  }

  if (jsonString.startsWith('{') && jsonString.endsWith('}')) {
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      console.error('-----JSON parse error: Object-----\n', e);
      return jsonString;
    }
  }

  if (jsonString.startsWith('[') && jsonString.endsWith(']')) {
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      console.error('-----JSON parse error: Array-----\n', e);
      return jsonString;
    }
  }

  return jsonString;
};

export default safeJsonParse;
