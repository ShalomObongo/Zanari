export async function notImplementedYet(taskId: string, scenario: string): Promise<never> {
  throw new Error(`NOT_IMPLEMENTED: ${taskId} - ${scenario}`);
}
