import localDbSvc from './localDbSvc';
import store from '../store';
import constants from '../data/constants';

const snippetContextLength = 56;
const searchChunkLength = 4096;
const workBeforeYield = 64;
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
const foldCase = value => value.toLowerCase().replace(/\u03c2/g, '\u03c3');

const makeAbortError = () => {
  const error = new Error('Workspace search was cancelled.');
  error.name = 'AbortError';
  return error;
};

const makeCheckpoint = isCancelled => {
  let workSinceYield = 0;
  return async () => {
    if (isCancelled()) {
      throw makeAbortError();
    }
    workSinceYield += 1;
    if (workSinceYield >= workBeforeYield) {
      workSinceYield = 0;
      await new Promise(resolve => setTimeout(resolve, 0));
      if (isCancelled()) {
        throw makeAbortError();
      }
    }
  };
};

const makeMatch = (text, query, caseSensitive) => {
  if (!query) {
    return null;
  }
  if (caseSensitive) {
    const start = text.indexOf(query);
    return start < 0 ? null : { start, end: start + query.length };
  }

  let foldedText = '';
  const starts = [];
  const ends = [];
  for (let offset = 0; offset < text.length;) {
    const character = String.fromCodePoint(text.codePointAt(offset));
    const characterEnd = offset + character.length;
    const foldedCharacter = foldCase(character);
    foldedText += foldedCharacter;
    for (let index = 0; index < foldedCharacter.length; index += 1) {
      starts.push(offset);
      ends.push(characterEnd);
    }
    offset = characterEnd;
  }

  const foldedQuery = foldCase(query);
  const foldedStart = foldedText.indexOf(foldedQuery);
  if (foldedStart < 0) {
    return null;
  }
  return {
    start: starts[foldedStart],
    end: ends[foldedStart + foldedQuery.length - 1],
  };
};

const makeSnippet = (text, match) => {
  const start = Math.max(0, match.start - snippetContextLength);
  const end = Math.min(text.length, match.end + snippetContextLength);
  return {
    before: `${start ? '…' : ''}${text.slice(start, match.start)}`,
    match: text.slice(match.start, match.end),
    after: `${text.slice(match.end, end)}${end < text.length ? '…' : ''}`,
  };
};

const isInExcludedFolderCooperatively = async (file, foldersById, checkpoint) => {
  let parentId = file.parentId;
  const seen = new Set();
  while (parentId && !seen.has(parentId)) {
    await checkpoint();
    if (parentId === 'trash' || parentId === 'temp') {
      return true;
    }
    seen.add(parentId);
    const parent = foldersById[parentId];
    if (!parent) {
      return false;
    }
    parentId = parent.parentId;
  }
  return false;
};

const getFolderPathCooperatively = async (file, foldersById, checkpoint) => {
  const path = [];
  let parentId = file.parentId;
  const seen = new Set();
  while (parentId && !seen.has(parentId)) {
    await checkpoint();
    seen.add(parentId);
    const parent = foldersById[parentId];
    if (!parent) {
      break;
    }
    path.unshift(parent.name || '');
    parentId = parent.parentId;
  }
  return path.join(' / ');
};

const compareResults = (left, right) => (
  collator.compare(left.folderPath, right.folderPath)
  || collator.compare(left.name, right.name)
  || left.fileId.localeCompare(right.fileId)
);

const sortResultsCooperatively = async (results, checkpoint) => {
  if (results.length < 2) {
    return results;
  }

  let source = results;
  let target = new Array(results.length);
  for (let width = 1; width < results.length; width *= 2) {
    for (let start = 0; start < results.length; start += width * 2) {
      const middle = Math.min(start + width, results.length);
      const end = Math.min(start + width * 2, results.length);
      let left = start;
      let right = middle;
      let output = start;

      while (left < middle && right < end) {
        target[output] = compareResults(source[left], source[right]) <= 0
          ? source[left++]
          : source[right++];
        output += 1;
        await checkpoint();
      }
      while (left < middle) {
        target[output++] = source[left++];
        await checkpoint();
      }
      while (right < end) {
        target[output++] = source[right++];
        await checkpoint();
      }
    }
    [source, target] = [target, source];
  }
  return source;
};

const makeMatchCooperatively = async (text, query, caseSensitive, checkpoint) => {
  if (!query) {
    return null;
  }

  if (caseSensitive) {
    let offset = 0;
    while (offset <= text.length - query.length) {
      const end = Math.min(text.length, offset + searchChunkLength + query.length - 1);
      const matchOffset = text.slice(offset, end).indexOf(query);
      if (matchOffset >= 0) {
        return { start: offset + matchOffset, end: offset + matchOffset + query.length };
      }
      if (end === text.length) {
        break;
      }
      offset += searchChunkLength;
      await checkpoint();
    }
    return null;
  }

  const foldedQuery = foldCase(query);
  let foldedCarry = '';
  let carryStarts = [];
  let carryEnds = [];
  let offset = 0;
  while (offset < text.length) {
    const chunkEnd = Math.min(text.length, offset + searchChunkLength);
    let foldedChunk = '';
    const chunkStarts = [];
    const chunkEnds = [];
    while (offset < chunkEnd) {
      const character = String.fromCodePoint(text.codePointAt(offset));
      const characterEnd = offset + character.length;
      const foldedCharacter = foldCase(character);
      foldedChunk += foldedCharacter;
      for (let index = 0; index < foldedCharacter.length; index += 1) {
        chunkStarts.push(offset);
        chunkEnds.push(characterEnd);
      }
      offset = characterEnd;
    }

    const foldedText = foldedCarry + foldedChunk;
    const starts = carryStarts.concat(chunkStarts);
    const ends = carryEnds.concat(chunkEnds);
    const matchOffset = foldedText.indexOf(foldedQuery);
    if (matchOffset >= 0) {
      return {
        start: starts[matchOffset],
        end: ends[matchOffset + foldedQuery.length - 1],
      };
    }

    const carryLength = Math.min(foldedQuery.length - 1, foldedText.length);
    foldedCarry = carryLength ? foldedText.slice(-carryLength) : '';
    carryStarts = carryLength ? starts.slice(-carryLength) : [];
    carryEnds = carryLength ? ends.slice(-carryLength) : [];
    await checkpoint();
  }
  return null;
};

const captureCurrentWorkspaceItemMaps = workspaceId => (
  store.getters['workspace/currentWorkspace'].id === workspaceId
    ? constants.types.map(type => store.state[type].itemsById)
    : []
);

const collectResults = async ({
  itemsById,
  query,
  searchName,
  searchContent,
  caseSensitive,
  workspaceId,
  checkpoint,
}) => {
  const foldersById = {};
  for (const id in itemsById) {
    const item = itemsById[id];
    if (item.type === 'folder') {
      foldersById[item.id] = item;
    }
    await checkpoint();
  }

  const results = [];
  for (const id in itemsById) {
    const file = itemsById[id];
    if (file.type !== 'file') {
      continue;
    }
    if (await isInExcludedFolderCooperatively(file, foldersById, checkpoint)) {
      await checkpoint();
      continue;
    }
    const content = itemsById[`${file.id}/content`];
    const text = content && typeof content.text === 'string' ? content.text : '';
    const nameMatch = searchName
      ? await makeMatchCooperatively(file.name || '', query, caseSensitive, checkpoint)
      : null;
    const contentMatch = searchContent
      ? await makeMatchCooperatively(text, query, caseSensitive, checkpoint)
      : null;
    if (!nameMatch && !contentMatch) {
      await checkpoint();
      continue;
    }
    results.push({
      workspaceId,
      fileId: file.id,
      name: file.name || '',
      folderPath: await getFolderPathCooperatively(file, foldersById, checkpoint),
      nameMatch,
      contentMatch,
      snippet: contentMatch ? makeSnippet(text, contentMatch) : null,
      query,
      caseSensitive,
    });
    await checkpoint();
  }
  return sortResultsCooperatively(results, checkpoint);
};

export default {
  searchWorkspace({
    workspaceId = store.getters['workspace/currentWorkspace'].id,
    query = '',
    searchName = true,
    searchContent = true,
    caseSensitive = false,
  } = {}) {
    const normalizedQuery = `${query}`;
    const inMemoryItemMaps = captureCurrentWorkspaceItemMaps(workspaceId);
    const itemsById = {};
    let cancelled = false;
    const read = localDbSvc.readWorkspaceItems(workspaceId, (item) => {
      if (item.hash) {
        itemsById[item.id] = item;
      }
    });

    const checkpoint = makeCheckpoint(() => cancelled);
    const promise = read.promise.then(async () => {
      if (store.getters['workspace/currentWorkspace'].id === workspaceId) {
        for (let mapIndex = 0; mapIndex < inMemoryItemMaps.length; mapIndex += 1) {
          const itemMap = inMemoryItemMaps[mapIndex];
          for (const id in itemMap) {
            const item = itemMap[id];
            itemsById[item.id] = { ...item };
            await checkpoint();
          }
        }
      }
      if (!normalizedQuery || (!searchName && !searchContent)) {
        return [];
      }
      return collectResults({
        itemsById,
        query: normalizedQuery,
        searchName,
        searchContent,
        caseSensitive,
        workspaceId,
        checkpoint,
      });
    });

    return {
      promise,
      cancel: () => {
        if (!cancelled) {
          cancelled = true;
          read.cancel();
        }
      },
    };
  },
  findMatch: makeMatch,
};
