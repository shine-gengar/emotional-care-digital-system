const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 找到所有标题为"你好小暖。"的会话
  const duplicateSessions = await prisma.chatSession.findMany({
    where: {
      title: '你好小暖。'
    },
    orderBy: { createdAt: 'asc' }
  });
  
  console.log(`找到 ${duplicateSessions.length} 个"你好小暖"会话`);
  
  if (duplicateSessions.length > 0) {
    // 保留第一个，删除其余的
    const toDelete = duplicateSessions.slice(1);
    console.log(`将删除 ${toDelete.length} 个重复会话`);
    
    for (const session of toDelete) {
      await prisma.chatSession.delete({
        where: { id: session.id }
      });
      console.log(`已删除: ${session.id}`);
    }
  }
  
  // 显示剩余会话
  const remaining = await prisma.chatSession.findMany({
    orderBy: { createdAt: 'desc' }
  });
  
  console.log(`\n清理完成，剩余 ${remaining.length} 个会话:`);
  remaining.forEach((s, i) => {
    console.log(`${i+1}. ${s.title} (${s.createdAt.toLocaleString()})`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
