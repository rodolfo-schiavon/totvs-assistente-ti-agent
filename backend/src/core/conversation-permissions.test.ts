import assert from "node:assert/strict";
import {
  canAuditAllConversations,
  canDeleteConversations,
  canExportConversations,
  canViewOwnConversationsOnly,
  hasConversationPermission,
} from "./conversation-permissions.js";

function testPermissions() {
  assert.equal(hasConversationPermission("admin", "delete_conversations"), true);
  assert.equal(hasConversationPermission("gerencia", "delete_conversations"), false);
  assert.equal(canAuditAllConversations("gerencia"), true);
  assert.equal(canViewOwnConversationsOnly("advogado"), true);
  assert.equal(canExportConversations("admin"), true);
  assert.equal(canDeleteConversations("admin"), true);
  console.log("conversation-permissions.test ok");
}

testPermissions();
