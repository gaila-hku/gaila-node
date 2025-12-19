import { isNull } from 'lodash-es';

import { GptLog } from 'types/db/gpt';
import { TraceData } from 'types/db/trace-data';

type Substring = {
  length: number;
  sequence: string;
  offset: number;
};

type PlagiarisedSegment = {
  offset: number;
  sequence: string;
  type: 'pasted' | 'repeated';
};

// Credits: https://en.wikibooks.org/wiki/Algorithm_Implementation/Strings/Longest_common_substring
function longestCommonSubstring(str1: string, str2: string) {
  if (!str1 || !str2)
    return {
      length: 0,
      sequence: '',
      offset: 0,
    };

  let sequence = '';
  const str1Length = str1.length;
  const str2Length = str2.length;
  const num = new Array(str1Length);
  let maxlen = 0;
  let lastSubsBegin = 0;

  for (let i = 0; i < str1Length; i++) {
    const subArray = new Array(str2Length);
    for (let j = 0; j < str2Length; j++) subArray[j] = 0;
    num[i] = subArray;
  }
  let thisSubsBegin = null;
  for (let i = 0; i < str1Length; i++) {
    for (let j = 0; j < str2Length; j++) {
      if (str1[i] !== str2[j]) num[i][j] = 0;
      else {
        if (i === 0 || j === 0) num[i][j] = 1;
        else num[i][j] = 1 + num[i - 1][j - 1];

        if (num[i][j] > maxlen) {
          maxlen = num[i][j];
          thisSubsBegin = i - num[i][j] + 1;
          if (lastSubsBegin === thisSubsBegin) {
            //if the current LCS is the same as the last time this block ran
            sequence += str1[i];
          } //this block resets the string builder if a different LCS is found
          else {
            lastSubsBegin = thisSubsBegin;
            sequence = ''; //clear it
            sequence += str1.substr(lastSubsBegin, i + 1 - lastSubsBegin);
          }
        }
      }
    }
  }
  return {
    length: maxlen,
    sequence: sequence,
    offset: thisSubsBegin,
  };
}

const getPlagiarisedSegments = (
  essay: string,
  gptLogs: GptLog[],
  traceLogs: TraceData[],
): PlagiarisedSegment[] => {
  let essayContent = essay;
  const textDetectedInGptLogs: Substring[] = [];

  for (const log of gptLogs) {
    // eslint-disable-next-line no-constant-condition
    while (1) {
      const answer = log.gpt_answer;
      const repeatedText = longestCommonSubstring(essayContent, answer);
      if (repeatedText.length <= 30 || isNull(repeatedText.offset)) {
        break;
      }
      essayContent =
        essayContent.slice(0, repeatedText.offset) +
        '@'.repeat(repeatedText.length) +
        essayContent.slice(repeatedText.offset + repeatedText.length);
      textDetectedInGptLogs.push({
        length: repeatedText.length,
        sequence: repeatedText.sequence,
        offset: repeatedText.offset,
      });
    }
  }

  textDetectedInGptLogs.sort((a, b) => {
    if (a.offset === b.offset) return b.length - a.length;
    return a.offset - b.offset;
  });

  const pastedTexts = traceLogs
    .filter(s => s.action === 'PASTE_TEXT_ESSAY')
    .map(s => (s.content as any as { pasted_text: string }).pasted_text);

  const plagiarisedSegments: PlagiarisedSegment[] = [];
  textDetectedInGptLogs.forEach(textObj => {
    let repeatedTextContent = textObj.sequence;
    const textDetectedAndPasted: Substring[] = [];

    for (const text of pastedTexts) {
      // eslint-disable-next-line no-constant-condition
      while (1) {
        const repeatedText = longestCommonSubstring(repeatedTextContent, text);
        if (repeatedText.length <= 30 || isNull(repeatedText.offset)) {
          break;
        }
        repeatedTextContent =
          repeatedTextContent.slice(0, repeatedText.offset) +
          '@'.repeat(repeatedText.length) +
          repeatedTextContent.slice(repeatedText.offset + repeatedText.length);
        textDetectedAndPasted.push({
          length: repeatedText.length,
          sequence: repeatedText.sequence,
          offset: repeatedText.offset,
        });
      }
    }

    plagiarisedSegments.push({
      offset: textObj.offset,
      sequence: textObj.sequence,
      type: textDetectedAndPasted.length > 0 ? 'pasted' : 'repeated',
    });
  });

  return plagiarisedSegments;
};

export default getPlagiarisedSegments;
