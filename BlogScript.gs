/**
 * ════════════════════════════════════════════════════════════
 *  두드림 모기지 — 블로그 관리 Apps Script
 *  설정 후 "배포 > 새 배포" → 웹 앱으로 배포하세요
 * ════════════════════════════════════════════════════════════
 *
 *  [설치 방법]
 *  1. script.google.com 열기
 *  2. 새 프로젝트 만들기 → 이 파일 내용 전체 붙여넣기
 *  3. SHEET_ID 를 본인 Google Sheets ID로 교체
 *     (Sheets URL에서 /d/XXXX/edit 의 XXXX 부분)
 *  4. 저장 후 "배포" > "새 배포" > 유형: 웹 앱
 *     - 실행 계정: 나 (나의 Google 계정)
 *     - 액세스 권한: 모든 사용자 (익명 포함)
 *  5. 배포 URL 복사 → index.html 의 BLOG_SCRIPT_URL 에 붙여넣기
 *
 *  [Google Sheets 구조]
 *  시트 이름: "Blog"
 *  열 순서: id | emoji | tagKo | tagEn | titleKo | titleEn |
 *           dateKo | dateEn | excerptKo | excerptEn |
 *           bodyKo | bodyEn | youtubeId | imageUrl | createdAt
 * ════════════════════════════════════════════════════════════
 */

const SHEET_ID   = 'YOUR_GOOGLE_SHEET_ID_HERE';  // ← 교체하세요
const SHEET_NAME = 'Blog';

const COLS = ['id','emoji','tagKo','tagEn','titleKo','titleEn',
              'dateKo','dateEn','excerptKo','excerptEn',
              'bodyKo','bodyEn','youtubeId','imageUrl','createdAt'];

/* ── 시트 가져오기 (없으면 자동 생성) ── */
function getSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // 헤더 행 작성
    sheet.appendRow(COLS);
    sheet.getRange(1, 1, 1, COLS.length)
         .setFontWeight('bold')
         .setBackground('#0B2D5E')
         .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/* ── 행 → 객체 변환 ── */
function rowToPost(row) {
  const post = {};
  COLS.forEach((col, i) => post[col] = row[i] || '');
  return post;
}

/* ── GET: 글 목록 반환 ── */
function doGet(e) {
  const action = e.parameter.action || 'getPosts';
  let result;

  try {
    if (action === 'getPosts') {
      const sheet = getSheet();
      const data  = sheet.getDataRange().getValues();
      if (data.length <= 1) {
        result = { posts: [] };
      } else {
        // 헤더 제외, 최신순 정렬 (createdAt 내림차순)
        const posts = data.slice(1)
          .map(row => rowToPost(row))
          .filter(p => p.id)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        result = { posts };
      }
    } else {
      result = { error: 'Unknown action' };
    }
  } catch(err) {
    result = { error: err.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ── POST: 글 추가 / 수정 / 삭제 ── */
function doPost(e) {
  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch(err) {
    return jsonResponse({ success: false, error: 'Invalid JSON' });
  }

  const action = payload.action;
  const sheet  = getSheet();

  try {
    if (action === 'addPost') {
      /* ── 새 글 추가 ── */
      const row = COLS.map(col => {
        if (col === 'createdAt') return new Date().toISOString();
        return payload[col] !== undefined ? payload[col] : '';
      });
      sheet.appendRow(row);
      return jsonResponse({ success: true, action: 'added', id: payload.id });

    } else if (action === 'updatePost') {
      /* ── 기존 글 수정 ── */
      const rowIdx = findRowById(sheet, payload.id);
      if (rowIdx < 0) return jsonResponse({ success: false, error: 'Post not found' });

      const updatedRow = COLS.map(col => {
        if (col === 'createdAt') {
          // 기존 createdAt 유지
          return sheet.getRange(rowIdx, COLS.indexOf('createdAt') + 1).getValue();
        }
        return payload[col] !== undefined ? payload[col] : '';
      });
      sheet.getRange(rowIdx, 1, 1, COLS.length).setValues([updatedRow]);
      return jsonResponse({ success: true, action: 'updated', id: payload.id });

    } else if (action === 'deletePost') {
      /* ── 글 삭제 ── */
      const rowIdx = findRowById(sheet, payload.id);
      if (rowIdx < 0) return jsonResponse({ success: false, error: 'Post not found' });
      sheet.deleteRow(rowIdx);
      return jsonResponse({ success: true, action: 'deleted', id: payload.id });

    } else {
      return jsonResponse({ success: false, error: 'Unknown action: ' + action });
    }

  } catch(err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

/* ── ID로 행 번호 찾기 (1-based, 헤더 포함) ── */
function findRowById(sheet, id) {
  const data = sheet.getDataRange().getValues();
  const idColIdx = COLS.indexOf('id');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idColIdx]) === String(id)) return i + 1;
  }
  return -1;
}

/* ── JSON 응답 헬퍼 ── */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
