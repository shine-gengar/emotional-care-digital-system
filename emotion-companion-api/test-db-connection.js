const mysql = require('mysql2');

// 创建连接
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'yang314159265354',
  database: 'emotion_companion'
});

// 测试连接
connection.connect((err) => {
  if (err) {
    console.error('连接失败:', err);
    return;
  }
  console.log('连接成功!');
  
  // 测试查询
  connection.query('SELECT 1 + 1 AS solution', (err, results) => {
    if (err) {
      console.error('查询失败:', err);
    } else {
      console.log('查询结果:', results);
    }
    connection.end();
  });
});
