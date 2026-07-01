const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sessions = await prisma.chatSession.findMany({
    include: {
      _count: {
        select: { messages: true }
      },
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 2
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log('总会话数:', sessions.length);
  console.log('\n会话列表:');
  sessions.forEach((s, i) => {
    console.log(`${i+1}. ID: ${s.id}`);
    console.log(`   标题: ${s.title}`);
    console.log(`   消息数: ${s._count.messages}`);
    console.log(`   创建时间: ${s.createdAt}`);
    console.log(`   第一条消息: ${s.messages[0]?.content?.substring(0, 30) || '无'}`);
    console.log('');
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
