let isStarted = false;
let successCount = 0;
let errorCount = 0;
let lastPose = '';
let lastPoseTime = Date.now();
let nickname = '';
let model, webcam, maxPredictions;
let labelContainer;

document.addEventListener('DOMContentLoaded', async function() {
    const nicknameInput = document.getElementById('nickname');
    const startButton = document.getElementById('start-btn');

    nicknameInput.addEventListener('input', function() {
        startButton.disabled = !this.value.trim();
    });

    // 웹캠 초기 설정
    const size = 400;
    const flip = true;
    webcam = new tmPose.Webcam(size, size, flip);
    await webcam.setup();
    await webcam.play();
    
    // 캔버스 크기 설정
    const canvas = document.getElementById('canvas');
    canvas.width = size;
    canvas.height = size;

    // 웹캠 업데이트 루프 시작
    function loop() {
        webcam.update();
        const ctx = canvas.getContext('2d');
        ctx.drawImage(webcam.canvas, 0, 0);
        window.requestAnimationFrame(loop);
    }
    window.requestAnimationFrame(loop);
});

document.getElementById('start-btn').addEventListener('click', async function() {
    nickname = document.getElementById('nickname').value.trim();
    this.disabled = true;
    
    // 모델 먼저 로드
    const modelURL = "https://teachablemachine.withgoogle.com/models/NHp88W0-V/model.json";
    const metadataURL = "https://teachablemachine.withgoogle.com/models/NHp88W0-V/metadata.json";
    model = await tmPose.load(modelURL, metadataURL);
    maxPredictions = model.getTotalClasses();
    
    // 올바른 자세 확인을 위한 메시지 표시
    const messageDiv = document.createElement('div');
    messageDiv.id = 'pose-message';
    messageDiv.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); ' +
                              'background-color: #ffe3e3; color: #e03131; padding: 15px; border-radius: 5px; ' +
                              'font-weight: bold; z-index: 1000;';
    messageDiv.textContent = '카메라 프레임 안에 서서 Up 자세를 취해주세요.';
    document.body.appendChild(messageDiv);
    
    // Up 자세 인식 대기
    let isCorrectPose = false;
    while (!isCorrectPose) {
        const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
        const prediction = await model.predict(posenetOutput);
        
        for (let i = 0; i < maxPredictions; i++) {
            if (prediction[i].className === 'Up' && prediction[i].probability > 0.8) {
                isCorrectPose = true;
                break;
            }
        }
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms 간격으로 체크
    }
    
    // 올바른 자세가 인식되면 메시지 제거 및 게임 시작
    document.body.removeChild(messageDiv);
    document.getElementById('nickname-container').style.display = 'none';
    document.getElementById('score-container').style.display = 'block';
    
    // 3초 카운트다운
    const counter = document.getElementById('counter');
    counter.style.display = 'block';
    for(let i = 3; i > 0; i--) {
        counter.textContent = i;
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    counter.style.display = 'none';
    
    isStarted = true;
    init();
});

async function init() {
    // 레이블 컨테이너 설정
    labelContainer = document.getElementById('label-container');
    for (let i = 0; i < maxPredictions; i++) {
        labelContainer.appendChild(document.createElement('div'));
    }

    // 예측 루프 시작
    window.requestAnimationFrame(predictLoop);
}

async function predictLoop() {
    await predict();
    if (isStarted) {
        window.requestAnimationFrame(predictLoop);
    }
}

function drawPose(pose) {
    const ctx = document.getElementById('canvas').getContext('2d');
    ctx.drawImage(webcam.canvas, 0, 0);
    
    if (pose) {
        const minPartConfidence = 0.5;
        tmPose.drawKeypoints(pose.keypoints, minPartConfidence, ctx);
        tmPose.drawSkeleton(pose.keypoints, minPartConfidence, ctx);
    }
}

async function predict() {
    const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
    const prediction = await model.predict(posenetOutput);
    
    // 가장 높은 확률의 포즈 찾기
    let maxProbability = 0;
    let currentPose = '';
    
    for (let i = 0; i < maxPredictions; i++) {
        if (prediction[i].probability > maxProbability) {
            maxProbability = prediction[i].probability;
            currentPose = prediction[i].className;
        }
        const classPrediction = prediction[i].className + ": " + prediction[i].probability.toFixed(2);
        labelContainer.childNodes[i].innerHTML = classPrediction;
    }
    
    // 동작 체크
    if (maxProbability > 0.8) {
        if (currentPose !== lastPose) {
            if (currentPose === 'Up' && lastPose === 'Down') {
                successCount++;
                document.getElementById('success-count').textContent = successCount;
                lastPoseTime = Date.now(); // Up-Down 성공 시에만 시간 갱신
            } else if (currentPose.includes('error')) {
                errorCount++;
                document.getElementById('error-count').textContent = errorCount;
            }
            lastPose = currentPose;
        }
    }
    
    // 현재 Up 또는 Down 자세인 경우 시간 갱신
    if (maxProbability > 0.8 && (currentPose === 'Up' || currentPose === 'Down')) {
        lastPoseTime = Date.now();
    }
    
    // 5초 이상 올바른 동작 없으면 종료
    if (Date.now() - lastPoseTime > 5000 && isStarted) {
        endExercise();
    }

    drawPose(pose);
}

function endExercise() {
    isStarted = false;
    webcam.stop();
    
    document.getElementById('score-container').style.display = 'block';
    document.getElementById('restart-btn').style.display = 'block';
    alert(`${nickname}님의 결과:\n성공 횟수: ${successCount}\n실수 횟수: ${errorCount}`);
}

// 다시 시작 기능 추가
document.getElementById('restart-btn').addEventListener('click', async function() {
    // 변수 초기화
    isStarted = false;
    successCount = 0;
    errorCount = 0;
    lastPose = '';
    lastPoseTime = Date.now();
    
    // UI 초기화
    document.getElementById('success-count').textContent = '0';
    document.getElementById('error-count').textContent = '0';
    document.getElementById('restart-btn').style.display = 'none';
    document.getElementById('nickname-container').style.display = 'flex';
    document.getElementById('score-container').style.display = 'none';
    
    // 닉네임 입력창 초기화
    document.getElementById('nickname').value = '';
    document.getElementById('start-btn').disabled = true;
    
    // 웹캠 재시작
    await webcam.play();
});