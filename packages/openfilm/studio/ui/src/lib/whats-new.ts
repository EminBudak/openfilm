/**
 * What this release brings, said to the person after an update, in every language Studio speaks (a release without them
 * all does not compile), grouped as new, improved and fixed. Only this release's: the dialog tells what the version now
 * running brings, and the changelog on GitHub keeps every release's.
 *
 * Written when a release is made (the "Version packages" pull request), in place of the release before's: the
 * changesets say everything that changed, for the changelog; these say every change a person would notice, in their
 * words, one line each (at most 24). A version without them fails the tests (whats-new.test.ts), so that pull request
 * cannot be merged until they are written.
 *
 * After an update they appear once (Studio's prefs keep `seenVersion`). A new install shows none: there is nothing it
 * was updated from.
 */
import type { Language } from '@/i18n';

export type NoteKind = 'new' | 'improved' | 'fixed';
export interface ReleaseNote { kind: NoteKind; text: string }
export interface ReleaseNotes { version: string; date: string; notes: Record<Language, ReleaseNote[]> }

export const RELEASE: ReleaseNotes = {
  version: '0.2.6',
  date: '2026-10-26',
  notes: {
    en: [
      { kind: 'new', text: 'Export: pick the exact frames and ranges. Frames go out as image files, a ZIP, a PDF or a PowerPoint deck; a video, GIF, audio or subtitle export takes up to 100 ranges, each its own file or merged into one.' },
      { kind: 'new', text: 'Version history is redesigned: versions by day with search and filters, a version plays without touching your edits, Restore saves your edits first, and any version can start a new project. Settings › Advanced › Auto versions saves them for you (off by default).' },
      { kind: 'new', text: 'Masks can have a stroke: a color and a width, inside, across or outside the edge.' },
      { kind: 'new', text: 'Layers can be deleted, not only hidden: with the bin, the menu or the Delete key, and undone like any edit.' },
      { kind: 'new', text: 'Settings › Agents › Switch account: Claude Code, Cursor and MiniMax Code sign in with another account from here; the other agents say where to switch.' },
      { kind: 'new', text: 'Each conversation remembers its agent, model and effort, after a restart too.' },
      { kind: 'new', text: 'Xiaomi MiMo writes subtitles and speaks voice-overs with your own key. Subtitles can fade in and out.' },
      { kind: 'improved', text: '剪映 and CapCut drafts get the film’s subtitles as the app’s own subtitles, on a subtitle track you can restyle and edit together.' },
      { kind: 'improved', text: 'Windows: installed agents are found more reliably (OpenCode, Copilot, DeepSeek Harness, MiniMax Code), with Refresh connections and help for each agent in Settings › Agents.' },
      { kind: 'improved', text: 'Long projects open at once. A click on the timeline’s ruler moves the playhead; ⌘-click or ⌘-drag (Ctrl on Windows) refers a moment or a span to the chat.' },
      { kind: 'improved', text: 'DeepSeek Harness shows each step as it works, and starts in the chat on Windows.' },
      { kind: 'fixed', text: 'Windows exports: on some NVIDIA computers video came out black, or an export drew one frame every five seconds (HEVC footage such as DJI’s). OpenFilm now checks that video shows and switches to a way that does.' },
      { kind: 'fixed', text: 'Exports keep their sound (Include sound is on each time), a page’s pictures and fonts are in every frame, and a video the browser can’t play is scaled down or named instead of coming out black.' },
      { kind: 'fixed', text: 'Windows: folders with Chinese names on the PATH reach the agents as they are, deleting says Recycle Bin, and a file preview’s close button is no longer under the one that quits.' },
      { kind: 'fixed', text: 'Security updates for Electron and the libraries the desktop app uses.' },
    ],
    'zh-CN': [
      { kind: 'new', text: '导出可以精确挑选帧和片段。帧可以导出为图片文件、ZIP、PDF 或 PowerPoint；视频、GIF、音频和字幕导出最多可选 100 个片段，每段单独成文件，或合并成一个。' },
      { kind: 'new', text: '版本历史重新设计：按天列出版本，可搜索和筛选；查看某个版本时直接播放，不影响当前编辑；恢复前会先保存当前编辑；任何版本都能另存为新项目。打开设置 › 高级 › 自动保存版本，就会自动保存（默认关闭）。' },
      { kind: 'new', text: '蒙版可以加描边：设置颜色和粗细，描在边缘内侧、居中或外侧。' },
      { kind: 'new', text: '图层可以删除，不只是隐藏：用垃圾桶图标、菜单或 Delete 键，和其他编辑一样可以撤销。' },
      { kind: 'new', text: '设置 › 智能体 › 切换账号：Claude Code、Cursor 和 MiniMax Code 可以直接在这里换账号登录；其他 agent 会说明去哪里切换。' },
      { kind: 'new', text: '每个对话都会记住自己用的 agent、模型和思考强度，重启后也一样。' },
      { kind: 'new', text: '小米 MiMo 可以用你自己的 key 识别字幕和生成配音。字幕可以淡入淡出。' },
      { kind: 'improved', text: '导出到剪映和 CapCut 草稿时，字幕会成为它们自己的字幕，放在字幕轨上，可以统一修改样式和编辑。' },
      { kind: 'improved', text: 'Windows：更可靠地找到已安装的 agent（OpenCode、Copilot、DeepSeek Harness、MiniMax Code）；设置 › 智能体里新增“刷新检查”，每个 agent 都有连接帮助。' },
      { kind: 'improved', text: '长项目能立即打开。点击时间线标尺会移动播放头；⌘ 点击或 ⌘ 拖动（Windows 上是 Ctrl）可以把某一时刻或一段引用到对话里。' },
      { kind: 'improved', text: 'DeepSeek Harness 工作时会逐步显示每一步，在 Windows 上也能在对话里启动。' },
      { kind: 'fixed', text: 'Windows 导出：在部分 NVIDIA 电脑上，视频会导出成黑屏，或者每五秒才画一帧（大疆等 HEVC 素材）。现在 OpenFilm 会先检查视频能否正常显示，不行就换一种能显示的方式。' },
      { kind: 'fixed', text: '导出不再丢声音（每次都默认包含声音）；页面里的图片和字体在每一帧都在；浏览器播放不了的视频会缩小后再用，或者明确指出是哪段，不再导出成黑屏。' },
      { kind: 'fixed', text: 'Windows：PATH 里带中文名的文件夹能正确传给 agent；删除时提示“回收站”；文件预览的关闭按钮不再压在退出按钮下面。' },
      { kind: 'fixed', text: '更新了 Electron 和桌面端所用库的安全修复。' },
    ],
    ja: [
      { kind: 'new', text: '書き出しで、フレームと範囲を正確に選べます。フレームは画像ファイル、ZIP、PDF、PowerPoint で書き出せ、動画・GIF・音声・字幕の書き出しでは最大 100 の範囲を、それぞれ別ファイルか 1 つにまとめて書き出せます。' },
      { kind: 'new', text: 'バージョン履歴を作り直しました。日ごとの一覧で検索と絞り込みができ、選んだバージョンは今の編集に触れずに再生され、復元の前には今の編集が保存され、どのバージョンからでも新しいプロジェクトを作れます。設定 › 詳細設定 › 自動バージョンで自動保存できます（既定はオフ）。' },
      { kind: 'new', text: 'マスクに線を付けられます。色と太さ、縁の内側・中央・外側を選べます。' },
      { kind: 'new', text: 'レイヤーを非表示だけでなく削除できます。ゴミ箱アイコン、メニュー、Delete キーで削除し、ほかの編集と同じく取り消せます。' },
      { kind: 'new', text: '設定 › エージェント › アカウントを切り替え：Claude Code、Cursor、MiniMax Code はここから別のアカウントでサインインでき、ほかのエージェントは切り替える場所を案内します。' },
      { kind: 'new', text: '会話ごとに使ったエージェント、モデル、思考の深さを覚えます。再起動後も同じです。' },
      { kind: 'new', text: 'Xiaomi MiMo が自分のキーで字幕の文字起こしとナレーションを担当できます。字幕はフェードイン・アウトできます。' },
      { kind: 'improved', text: '剪映と CapCut の下書きでは、映像の字幕がアプリ自身の字幕として字幕トラックに入り、まとめてスタイル変更や編集ができます。' },
      { kind: 'improved', text: 'Windows：インストール済みのエージェント（OpenCode、Copilot、DeepSeek Harness、MiniMax Code）がより確実に見つかります。設定 › エージェント に「接続を再確認」と、エージェントごとの接続ヘルプがあります。' },
      { kind: 'improved', text: '長いプロジェクトがすぐ開きます。タイムラインのルーラーをクリックすると再生ヘッドが移動し、⌘ クリックや ⌘ ドラッグ（Windows では Ctrl）で瞬間や範囲をチャットに参照できます。' },
      { kind: 'improved', text: 'DeepSeek Harness が作業の各ステップをその都度表示し、Windows でもチャットで起動します。' },
      { kind: 'fixed', text: 'Windows の書き出し：一部の NVIDIA 搭載 PC で、動画が黒くなったり、5 秒に 1 フレームしか描かれなかったりしました（DJI などの HEVC 素材）。動画が表示されるかを確かめ、表示される方法に切り替えるようになりました。' },
      { kind: 'fixed', text: '書き出しで音が消えなくなり（毎回「音声を含める」がオン）、ページの画像とフォントがすべてのフレームに入り、ブラウザで再生できない動画は縮小して使うか、どのクリップかを示し、黒くなりません。' },
      { kind: 'fixed', text: 'Windows：PATH にある中国語名のフォルダがエージェントに正しく渡り、削除時は「ごみ箱」と表示され、ファイルプレビューの閉じるボタンが終了ボタンの真下に来なくなりました。' },
      { kind: 'fixed', text: 'Electron とデスクトップアプリが使うライブラリのセキュリティ修正を取り込みました。' },
    ],
    ko: [
      { kind: 'new', text: '내보내기에서 프레임과 구간을 정확히 고를 수 있습니다. 프레임은 이미지 파일, ZIP, PDF, PowerPoint로 내보내고, 동영상·GIF·오디오·자막 내보내기는 최대 100개 구간을 각각 파일로 또는 하나로 합쳐 내보냅니다.' },
      { kind: 'new', text: '버전 기록을 새로 설계했습니다. 날짜별 목록에서 검색하고 걸러 볼 수 있고, 고른 버전은 지금 편집을 건드리지 않고 재생되며, 복원 전에 지금 편집을 먼저 저장하고, 어떤 버전으로든 새 프로젝트를 시작할 수 있습니다. 설정 › 고급 › 자동 버전으로 자동 저장할 수 있습니다(기본은 꺼짐).' },
      { kind: 'new', text: '마스크에 테두리를 넣을 수 있습니다. 색과 두께, 가장자리 안쪽·가운데·바깥쪽을 고릅니다.' },
      { kind: 'new', text: '레이어를 숨기기만 하지 않고 삭제할 수 있습니다. 휴지통 아이콘, 메뉴, Delete 키로 지우고, 다른 편집처럼 되돌릴 수 있습니다.' },
      { kind: 'new', text: '설정 › 에이전트 › 계정 전환: Claude Code, Cursor, MiniMax Code는 여기서 다른 계정으로 로그인하고, 다른 에이전트는 어디서 바꾸는지 알려 줍니다.' },
      { kind: 'new', text: '대화마다 사용한 에이전트, 모델, 추론 강도를 기억합니다. 다시 시작해도 그대로입니다.' },
      { kind: 'new', text: 'Xiaomi MiMo가 내 키로 자막 받아쓰기와 내레이션을 합니다. 자막은 페이드 인·아웃할 수 있습니다.' },
      { kind: 'improved', text: '剪映와 CapCut 초안에서 영상의 자막이 앱 자체 자막으로 자막 트랙에 들어가, 한꺼번에 스타일을 바꾸고 편집할 수 있습니다.' },
      { kind: 'improved', text: 'Windows: 설치된 에이전트(OpenCode, Copilot, DeepSeek Harness, MiniMax Code)를 더 확실히 찾습니다. 설정 › 에이전트에 연결 다시 확인과 에이전트별 연결 도움말이 생겼습니다.' },
      { kind: 'improved', text: '긴 프로젝트가 바로 열립니다. 타임라인 눈금자를 클릭하면 재생 헤드가 이동하고, ⌘ 클릭이나 ⌘ 드래그(Windows에서는 Ctrl)로 한 순간이나 구간을 채팅에 참조합니다.' },
      { kind: 'improved', text: 'DeepSeek Harness가 작업하는 동안 단계마다 보여 주고, Windows에서도 채팅에서 시작됩니다.' },
      { kind: 'fixed', text: 'Windows 내보내기: 일부 NVIDIA 컴퓨터에서 동영상이 검게 나오거나 5초에 한 프레임씩만 그려졌습니다(DJI 등의 HEVC 소스). 이제 동영상이 보이는지 확인하고, 보이는 방식으로 바꿉니다.' },
      { kind: 'fixed', text: '내보내기에서 소리가 빠지지 않고(매번 소리 포함이 켜짐), 페이지의 그림과 글꼴이 모든 프레임에 들어가며, 브라우저가 재생하지 못하는 동영상은 줄여서 쓰거나 어느 클립인지 알려 주고 검게 나오지 않습니다.' },
      { kind: 'fixed', text: 'Windows: PATH에 있는 중국어 이름 폴더가 에이전트에 그대로 전달되고, 삭제할 때 휴지통이라고 표시되며, 파일 미리 보기의 닫기 버튼이 종료 버튼 바로 아래에 오지 않습니다.' },
      { kind: 'fixed', text: 'Electron과 데스크톱 앱이 쓰는 라이브러리의 보안 수정을 반영했습니다.' },
    ],
    es: [
      { kind: 'new', text: 'Exportar: elige los fotogramas y tramos exactos. Los fotogramas salen como imágenes, un ZIP, un PDF o una presentación de PowerPoint; una exportación de vídeo, GIF, audio o subtítulos admite hasta 100 tramos, cada uno en su archivo o unidos en uno.' },
      { kind: 'new', text: 'El historial de versiones es nuevo: versiones por día con búsqueda y filtros, una versión se reproduce sin tocar tus cambios, Restaurar guarda primero tus cambios y cualquier versión puede empezar un proyecto nuevo. Configuración › Avanzado › Versiones automáticas las guarda por ti (desactivado por defecto).' },
      { kind: 'new', text: 'Las máscaras pueden tener contorno: un color y un grosor, por dentro, centrado o por fuera del borde.' },
      { kind: 'new', text: 'Las capas se pueden eliminar, no solo ocultar: con la papelera, el menú o la tecla Supr, y se deshace como cualquier cambio.' },
      { kind: 'new', text: 'Configuración › Agentes › Cambiar de cuenta: Claude Code, Cursor y MiniMax Code inician sesión con otra cuenta desde aquí; los demás agentes indican dónde cambiarla.' },
      { kind: 'new', text: 'Cada conversación recuerda su agente, modelo y esfuerzo, también tras reiniciar.' },
      { kind: 'new', text: 'Xiaomi MiMo transcribe subtítulos y pone voz con tu propia clave. Los subtítulos pueden aparecer y desaparecer con un fundido.' },
      { kind: 'improved', text: 'Los borradores de 剪映 y CapCut reciben los subtítulos de la película como subtítulos propios de la app, en una pista de subtítulos que puedes editar y restilizar a la vez.' },
      { kind: 'improved', text: 'Windows: los agentes instalados se encuentran mejor (OpenCode, Copilot, DeepSeek Harness, MiniMax Code), con Actualizar conexiones y ayuda para cada agente en Configuración › Agentes.' },
      { kind: 'improved', text: 'Los proyectos largos se abren al instante. Un clic en la regla de la línea de tiempo mueve el cabezal; ⌘-clic o ⌘-arrastrar (Ctrl en Windows) remite un momento o un tramo al chat.' },
      { kind: 'improved', text: 'DeepSeek Harness muestra cada paso mientras trabaja y se inicia en el chat en Windows.' },
      { kind: 'fixed', text: 'Exportaciones en Windows: en algunos equipos con NVIDIA el vídeo salía negro o se dibujaba un fotograma cada cinco segundos (material HEVC como el de DJI). OpenFilm comprueba ahora que el vídeo se ve y cambia a un modo en que sí se ve.' },
      { kind: 'fixed', text: 'Las exportaciones conservan el sonido (Incluir sonido está activado cada vez), las imágenes y fuentes de una página están en cada fotograma, y un vídeo que el navegador no reproduce se reduce o se nombra en lugar de salir negro.' },
      { kind: 'fixed', text: 'Windows: las carpetas con nombre chino en el PATH llegan bien a los agentes, eliminar dice Papelera de reciclaje y el botón de cerrar de una vista previa ya no queda bajo el de salir.' },
      { kind: 'fixed', text: 'Actualizaciones de seguridad de Electron y de las bibliotecas que usa la app de escritorio.' },
    ],
  },
};

/** -1, 0 or 1 as `a` is older than, the same as or newer than `b` (x.y.z; a pre-release is older than its release). */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const [core, pre = ''] = v.split('-');
    return { parts: core.split('.').map((n) => Number(n) || 0), pre };
  };
  const x = parse(a), y = parse(b);
  for (let i = 0; i < 3; i++) {
    const d = (x.parts[i] ?? 0) - (y.parts[i] ?? 0);
    if (d) return Math.sign(d);
  }
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1;
  if (!y.pre) return -1;
  return x.pre < y.pre ? -1 : 1;
}

/** This release's notes when `version` is this release, else null. */
export function releaseNotes(version: string, release: ReleaseNotes = RELEASE): ReleaseNotes | null {
  return compareVersions(release.version, version) === 0 ? release : null;
}

/** Said on the window to show this release's notes again (Settings → About, Developer's preview). */
export const WHATS_NEW_EVENT = 'openfilm:whats-new';
export function showWhatsNew(): void {
  window.dispatchEvent(new CustomEvent(WHATS_NEW_EVENT));
}
