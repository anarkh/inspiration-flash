// 数组 reduce 方法的实现
Array.prototype.myReduce = function myReduce(fn, total = 0) {
  let sum = total;
  this.forEach(element => {
    sum = fn(sum, element);
  })

  return sum;
}
const arr = [1];

const sum = arr.myReduce((acc, cur) => acc + cur, 0);

console.log(sum); // 10

// 题目描述
// versions是一个项目的版本号列表，因多人维护，不规则
// javascript

// 要求从小到大排序，注意'1.45'比'1.5'大
var versions=['1.45.0','1.5','6','3.3.3.3.3.3.3']
function sortVersion(arr) {
  return arr.sort((pre, next) => {
    const preArr = pre.split('.');
    const nextArr = next.split('.');

    let flag = 0;
    for(let i = 0; i < preArr.length && i < nextArr.length; i++) {
      if (preArr[i] < nextArr[i]) {
        flag = -1;
        break;
      }
      if (preArr[i] > nextArr[i]) {
        flag = 1;
        break;
      }
    }
    return flag;
  });
}
console.log(sortVersion(versions));