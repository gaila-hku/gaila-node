const parseQueryNumber = (v: any): number | undefined => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseInt(v, 10);
  if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'string')
    return parseInt(v[0], 10);
  return undefined;
};

export default parseQueryNumber;
