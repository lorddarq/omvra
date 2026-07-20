import assert from 'node:assert/strict';
import test from 'node:test';
import { GOAL_TEMPLATES, instantiateGoalTemplate } from './goalTemplates.ts';

test('ships sixteen valid goal templates with remapped graph references', () => {
  assert.equal(GOAL_TEMPLATES.length, 16);

  GOAL_TEMPLATES.forEach((template, index) => {
    let id = 0;
    const goal = instantiateGoalTemplate(template, prefix => `${prefix}_${index}_${id++}`);
    const elementIds = new Set(goal.elements.map(element => element.id));
    const root = goal.elements.find(element => element.type === 'goal');

    assert.ok(root, `${template.id} should include a goal root`);
    assert.equal(new Set(goal.elements.map(element => element.id)).size, goal.elements.length);
    assert.ok(goal.title.length > 0);
    goal.elements.filter(element => element.type === 'connector').forEach(connection => {
      assert.ok(connection.sourceId && elementIds.has(connection.sourceId), `${template.id} has a missing connector source`);
      assert.ok(connection.targetId && elementIds.has(connection.targetId), `${template.id} has a missing connector target`);
    });
  });
});
