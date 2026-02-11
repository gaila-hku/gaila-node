import { Response } from 'express';
import { isNumber } from 'lodash-es';
import {
  fetchAssignmentToolsByAssignmentId,
  updateAssignmentToolConfigById,
} from 'models/assignmentToolModel';
import { fetchTemplates, updateTemplate } from 'models/chatbotTemplateModel';

import { AuthorizedRequest } from 'types/request';
import parseQueryNumber from 'utils/parseQueryNumber';

export const getTemplateListing = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  if (!req.user?.id) {
    return res
      .status(401)
      .json({ error_message: 'User not authenticated', error_code: 401 });
  }

  try {
    const assignmentId = parseQueryNumber(req.query.assignment_id);
    if (isNumber(assignmentId)) {
      return res.json(await fetchAssignmentToolsByAssignmentId(assignmentId));
    }
    return res.json(await fetchTemplates());
  } catch (e) {
    return res.status(400).json({
      error_message: 'Invalid query parameters: ' + (e as Error).message,
      error_code: 400,
    });
  }
};

export const updateGeneralSettings = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  if (!req.user?.id) {
    return res
      .status(401)
      .json({ error_message: 'User not authenticated', error_code: 401 });
  }

  if (!isNumber(req.body.template_id)) {
    return res
      .status(400)
      .json({ error_message: 'Template ID is required', error_code: 400 });
  }

  if (!req.body.role_prompt) {
    return res
      .status(400)
      .json({ error_message: 'Role prompt is required', error_code: 400 });
  }

  if (!req.body.config) {
    return res
      .status(400)
      .json({ error_message: 'Config is required', error_code: 400 });
  }

  const template = await updateTemplate(
    req.body.template_id,
    req.body.description,
    req.body.role_prompt,
    req.body.config,
  );

  return res.json(template);
};

export const updateAssignmentToolSettings = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  if (!isNumber(req.body.assignment_tool_id)) {
    return res
      .status(400)
      .json({ error_message: 'Tool ID is required', error_code: 400 });
  }

  const tool = await updateAssignmentToolConfigById(
    req.body.assignment_tool_id,
    req.body.role_prompt,
    req.body.config,
  );

  return res.json(tool);
};
