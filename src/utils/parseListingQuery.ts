import { Request } from 'express';

import parseQueryNumber from 'utils/parseQueryNumber';

const parseListingQuery = (req: Request) => {
  const parsedLimit = parseQueryNumber(req.query.limit);
  const parsedPage = parseQueryNumber(req.query.page);

  const limit = parsedLimit !== undefined ? parsedLimit : 10;
  const page = parsedPage !== undefined ? parsedPage : 1;

  const filter = req.query.filter ? JSON.parse(req.query.filter as string) : {};
  const sort = req.query.sort;
  const sortOrder = req.query.sort_order;

  if (isNaN(limit) || isNaN(page) || limit <= 0 || page <= 0) {
    throw new Error('Invalid pagination parameters');
  }

  return { limit, page, filter, sort, sortOrder };
};

export default parseListingQuery;
