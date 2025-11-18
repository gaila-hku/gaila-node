const natureCodeMap: Record<number, string> = {
  0: 'Irrelevant',
  1: 'perform',
  2: 'learning',
};

export const convertPromptNatureObject = (
  results: { code: number; count: number }[],
): Record<string, number> => {
  return results.reduce(
    (acc, item) => {
      const nature = natureCodeMap[item.code];
      if (nature) {
        acc[nature] = item.count;
      }
      return acc;
    },
    {} as Record<string, number>,
  );
};

const aspectCodeMap: Record<number, string> = {
  0: 'Irrelevant',
  1: 'content_idea',
  2: 'structure',
  3: 'revision',
  4: 'language',
  5: 'rhetoric',
  6: 'error_correction',
};

export const convertPromptAspectObject = (
  results: { code: number; count: number }[],
): Record<string, number> => {
  return results.reduce(
    (acc, item) => {
      const aspect = aspectCodeMap[item.code];
      if (aspect) {
        acc[aspect] = item.count;
      }
      return acc;
    },
    {} as Record<string, number>,
  );
};
