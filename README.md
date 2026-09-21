# Note Filer: Obsidian Plugin

Typesafe AI Jev を用いて、ファイル名と内容からノートの分類を推定し、分類済みフォルダに移動する。
整備された分類階層に則ったフォルダ体系で整理することで、ノートにアクセスしやすくし、単一フォルダの肥大化を防ぐことができる。

- 動作環境
  - デスクトップのみ
- 起動方法
  - コマンド `Categorize current note and move`
  - ステータスバーの本のアイコンをクリックする
  - ナビゲーションでファイル/フォルダを右クリックして `Categorize and move` を選択する
- 対象ノート
  - `.md` ファイルのみ対象とする。
  - コマンドとステータスバーのアイコンは、現在表示中の単一ノートを対象とする。ノートが表示されていない場合はエラーメッセージを表示する。
  - 右クリックは、選択したファイル/フォルダを対象とする。フォルダの場合はサブフォルダ以下も再帰的に対象となる。
  - `Categorized Folder` 内のノートであっても対象とすることができる。
- 設定
  - `Typesafe API Server URL`: Typesafe AI Jev のAPIサーバのURLを指定する。リセットボタンでデフォルト値をセットする。デフォルト: `https://api.typesafe.ai/v1/systemone`
  - `Typesafe API Key`: Typesafe AI Jev のAPIキーを指定する。
  - `Categorized Folder`: 分類済みノートを格納するルートフォルダを指定する。例: `Categorized`  
  - `Categorization Method`: 分類法を指定する。
    - `Thema`: [EDItEUR](https://www.editeur.org/2/About/) が公開している刊行物分類体系。
    - `IAB Contents Taxonomy`: [IAB Tech Lab](https://www.iab.com/) が公開しているWebコンテンツ分類の国際標準。
  - `Categorization Depth`: 分類法の階層のうち、どの深さまで分類するかを指定する。1以上の整数値を指定する。分類法の階層数を超える場合は最下層まで分類する。デフォルト: 2
  - `Confidence Threshold`: 分類候補の自信度の閾値を指定する。分類実行画面で使用し、設定画面でもこの画面でも変更可能。0.0 から 1.0 の範囲で指定する。デフォルト: 0.4

### 外部サービスへの送信

分類のため、ノートのタイトルと本文の冒頭200字（画像行・空行を除く）を、`Typesafe API Server URL` に設定したサーバへ送信する。それ以外の内容（フロントマター、本文の残り、他のノート）は送信しない。

### UI

アイコンは `library-big` を使用する。

ステータスバーにはクリック可能なアイコンを配置する。

#### 実行中の表示

上記起動方法により起動するとアイコンの隣に進捗バーが表示され、分類中であることを示す。
あわせて `circle-x` アイコン（ツールチップ: `Note Filer: Cancel`）を表示する。押すと分類を中止し、通信中のリクエストを破棄する。中止した場合は分類実行画面を表示しない。

#### 分類実行画面

分類候補の算出が終わると一覧(分類実行画面)が表示される。各行は2行構成となっており、次の要素が並ぶ：

- 1行目
  - ファイル名: ノートのファイル名。
  - 分類候補プルダウン: "分類ラベル名(自信度)" の形式で表示される。候補は最大3件で、初期表示は1位の候補。自信度は 0.0 から 1.0 の範囲で、分類の確からしさを示す。`Other` は表示しない。
    - エラーなどで候補が得られなかった場合は、プルダウンの代わりに「エラー」のラベルを表示し、移動ボタンを無効にする。
- 2行目
  - 現在のフォルダパス: トップ階層の場合は `(root)` と表示される
  - 移動先フォルダパス: 分類候補プルダウンで選択された分類ラベルに対応するフォルダパス。 `<Categorized Folder>/<分類ラベル名でネストしたフォルダ>` の形式で表示される。
- 行の下部
  - 警告メッセージ: 移動ボタンが無効な理由を表示する。移動先に同名のファイルがある場合は、その旨を表示する。
- 行またぎ
  - スキップボタン: 押すと移動せずに行を削除する。
  - 移動ボタン: 押すと移動先フォルダにノートを移動し、行を削除する。移動先のフォルダと現在のフォルダが同じ場合はボタンがOKボタンとなり、押すと移動せずに行を削除する。次の場合は無効になる。
    - 候補が得られなかった（「エラー」の表示）。
    - 移動先に同名のファイルがある。プルダウンで選択を変えて移動先が変わったときも判定し直す。

一覧の下部には右寄せで次の要素が並ぶ：

- ファイル数: 分類対象となるノートの数
- 分類法: 現在の分類法
- 自信度閾値: すべて移動ボタンで移動する対象を決める閾値。0.0 から 1.0 の範囲で指定する。デフォルト: 0.4
  - プルダウンで選択中の候補の自信度が閾値以上の行だけが、すべて移動の対象となる。閾値未満の行は、行の表示は変わらず、すべて移動では移動されずに一覧に残る。
  - 移動ボタンが無効な行（エラー、同名ファイルあり）は対象外。
- キャンセルボタン: 押すと一覧を閉じる。
- すべて移動ボタン: 押すと、上記の対象の行のノートを、プルダウンの選択内容に従ってすべて移動する。移動対象が100件以上ある場合は、押下時に確認ダイアログを表示する。

#### 設定UI

- `Typesafe API Key` は Obsidian の SecretStorage（`SecretComponent`）を使って保管する。設定（`data.json`）には、シークレットの名前だけを保存する。APIキーが必要なときは `app.secretStorage.getSecret(名前)` で取得する。
- `Categorized Folder` は選択可能なフォルダリストから選択する。

#### 移動

ノートの移動には、`app.fileManager.renameFile` を使用する。

- 移動先のフォルダが存在しない場合は、階層ごと作成する。
- 移動先に同名のファイルがある場合は移動できない。一覧の表示時とプルダウンの変更時に判定し、該当する行は移動ボタンを無効にして警告メッセージを表示する。すべて移動の対象外となる。
- 移動の直前にも同名ファイルの有無を確認する。一覧の表示後に衝突が生じていた場合は、エラーメッセージを表示して移動せず、その行は一覧に残す。すべて移動の場合は、その行以外の移動を続ける。

#### Undo

実装しない。

### アーキテクチャ

#### 分類法ファイル

分類法ファイルは、`assets\raw` フォルダに格納される。このままでは形式がバラバラなのとObsidianプラグインとして同梱できないため、事前に下記の形式に変換しておき、esbuildでバンドルする。変換は `npm run taxonomy`（`scripts/build-taxonomy.mjs`）で行い、変換後のJSON（`src/taxonomy/data/Thema.json`、`src/taxonomy/data/IAB_ContentsTaxonomy.json`）はリポジトリに含める。

変換時の規則：

- ラベルは英語のみ。
- Thema のクオリファイア（`1`〜`6` 配下など、数字始まりのコード）は除外する。
- パスとして使えない文字（`\ / : * ? " < > |`）が分類ラベルに含まれている場合は空白に置換し、連続する空白は1つにまとめる。（例: `Action/Adventure` → `Action Adventure`、`The arts: general topics` → `The arts general topics`）
- `&` は `and` に置換する。（例: `Food & Drink` → `Food and Drink`）
- 説明文（Thema の CodeNotes など）は含めない。
- `code` は文字列。Thema はコード（`A`, `AB` など）、IAB は `Unique ID` を使用する。
- 葉ノードでは `children` を省略する。

形式は次のとおり（Thema の例）：

```json
{
  "root": {
    "children": [
      {
        "code": "A",
        "label": "The Arts",
        "children": [
          {
            "code": "AB",
            "label": "The arts general topics",
            "children": [
              {
                "code": "ABA",
                "label": "Theory of art"
              }
            ]
          }
        ]
      },
      {
        "code": "C",
        "label": "Language and Linguistics"
      }
    ]
  }
}
```

#### ロジックのレイヤー

コードベースは適切にレイヤー分けする。少なくとも、「UI（メインのソース）」「分類法の読み込み」「分類候補の算出」は分ける。テスタビリティを意識。

#### Typesafe AI

使用方法はスキル `typesafe:typesafe-ai` 参照。

`D:\develop\workspace\jev-poc` で事前にJevを検証した結果 `D:\develop\workspace\jev-poc\reports\recommendation_single_level.md` を参考にする。

##### 分類の進め方

- 1階層ずつ質問する。1階層目の質問（選択肢はトップ階層のカテゴリ）の回答を受けて、その回答カテゴリの子を選択肢とする2階層目の質問をする。これを `Categorization Depth` の階層まで繰り返す。各階層の回答は、`Other` を除いて確率が最も高いカテゴリを採用する。
- フォルダは分類の階層と同じ構造で切る。例: 2階層目まで分類した場合は `<Categorized Folder>/<1階層目のラベル>/<2階層目のラベル>`。
- 分類候補は、最終階層の質問の確率が高い順に `Other` を除いた上位3件とする。自信度はその質問での確率とする。
- すべての質問の選択肢に `Other` を常に加える。`Other` は分類実行画面のプルダウンには表示しない。
- 選択肢が100以上ある質問は、リクエストを分けず、質問を分ける。1リクエストの中に、選択肢が100未満の質問を複数入れる。分けた質問にもそれぞれ `Other` を加える。

##### リクエストの構成

報告書の推奨に従う。

- 1ノートにつき1階層ごとに1リクエスト。複数ノートのバッチはしない。
- 並列は8程度。429/5xx は指数バックオフで再試行する。
- 通信には Obsidian の `requestUrl` を使う。
- state は `{title, body}`。タイトルと本文の冒頭200字（画像行・空行を除く）。フロントマターは入れない。
- 選択肢のキーは分類法のコード、値は英語の名称（`Other` を除く）。
- CodeNotes などの説明は付けない。
- model は `jev-latest`。
- 質問文は報告書で検証した言い回しを使う。2階層目以降は「『{親の名称}』の中で、どの{N}階層目カテゴリか」を問う形に変える（報告書の3階層目の質問文に準ずる）。IAB の質問文は報告書に無いので、Thema に準じて作成する（未検証）。

### 初期作業（サンプルプラグインからの置き換え）

完了。`manifest.json`、`versions.json`、`package.json`、`LICENSE`、`AGENTS.md` を本プラグイン用に更新し、`src/main.ts`、`src/settings.ts` のサンプルコードを削除した。`id` は `note-filer`、フォルダ名は `obsidian-note-filer` のまま（`id` には `obsidian-` を付けない。他の多くのプラグインの慣例に合わせる）。`minAppVersion` は SecretStorage を使うため `1.11.4`。

## ライセンス

本プラグインのライセンスは、ソースコード部分にのみ適用される。プラグインに同梱している分類法データには、次のとおり各提供元のライセンスが適用される。

### Thema (EDItEUR)

本プラグインは、EDItEUR が提供する Thema subject category scheme (v1.6, English) のコードと名称を、入れ子JSONに変換して同梱している（説明文・クオリファイアは含まない。名称中のパスに使えない文字の空白への置換と `&` → `and` の置換を行っている）。Thema は EDItEUR の著作物であり、EDItEUR の [Licence to Use EDItEUR Standards](https://doi.org/10.4400/nwgj) に従って使用している。EDItEUR は本プラグインを承認・保証していない。同梱データは古くなる可能性があるため、最新版は EDItEUR のサイトを参照すること。

This plugin bundles a subset of the Thema subject category scheme (version 1.6, English), created and maintained by EDItEUR (https://www.editeur.org/151/Thema/). Only codes and headings are included; qualifiers and notes are omitted, and headings have been modified (characters not allowed in file paths replaced with spaces, "&" replaced with "and"). Thema is used under the EDItEUR Licence to Use EDItEUR Standards (https://doi.org/10.4400/nwgj). Thema © EDItEUR. EDItEUR does not endorse this plugin and accepts no liability for its use. The bundled data may become outdated; see the EDItEUR website for the current version.

### IAB Tech Lab Content Taxonomy 3.1

本プラグインは、IAB Technology Laboratory, Inc.（IAB Tech Lab）の Content Taxonomy 3.1 のカテゴリ名とIDを基に、名称のみを入れ子JSONに変換して同梱している（名称中のパスに使えない文字の空白への置換と `&` → `and` の置換を行っており、原典から改変されている）。ライセンスは [Creative Commons Attribution 3.0 (CC BY 3.0)](https://creativecommons.org/licenses/by/3.0/)。

This plugin includes an adaptation of the IAB Tech Lab Content Taxonomy 3.1 (https://github.com/InteractiveAdvertisingBureau/Taxonomies), © IAB Technology Laboratory, Inc., licensed under the Creative Commons Attribution 3.0 License (https://creativecommons.org/licenses/by/3.0/). The taxonomy was modified: only category names are extracted and converted to nested JSON, characters not allowed in file paths are replaced with spaces, and "&" is replaced with "and". IAB Tech Lab does not endorse this plugin.
