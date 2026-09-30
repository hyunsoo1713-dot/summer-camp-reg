// 서버 전용: 얼굴 인식 연결 (Amazon Rekognition)
//
// 필요한 서버 환경변수 (Cloud Run 비밀값으로 설정):
//   AWS_REGION             예: ap-northeast-2 (서울)
//   AWS_ACCESS_KEY_ID      얼굴 인식 전용 IAM 사용자 키
//   AWS_SECRET_ACCESS_KEY
//
// 비용을 아끼기 위한 방식:
//   - 행사 사진은 IndexFaces 한 번으로 사진 속 얼굴 전부를 등록 (얼굴 수와 관계없이 사진 1장당 1회 요금)
//   - 분류할 때는 참가자 1명당 SearchFaces 한 번으로 그 사람과 닮은 얼굴을 모두 찾음
//   - 얼굴이 하나도 없는 사진만 DetectLabels로 "사람이 있는지(뒷모습 등)" 추가 확인
import {
  RekognitionClient,
  CreateCollectionCommand,
  DeleteCollectionCommand,
  IndexFacesCommand,
  SearchFacesCommand,
  DetectLabelsCommand,
  DeleteFacesCommand,
} from '@aws-sdk/client-rekognition';

export interface BBox { left: number; top: number; width: number; height: number }
export interface IndexedFace { faceId: string; bbox: BBox }
export interface FaceMatch { faceId: string; externalId: string; similarity: number }

export interface FaceProvider {
  ensureCollection(collectionId: string): Promise<void>;
  deleteCollection(collectionId: string): Promise<void>;
  /** 참가자 얼굴 등록: 얼굴이 정확히 1개여야 함 */
  enrollFace(collectionId: string, image: Buffer, externalId: string): Promise<{ status: 'ok'; faceId: string } | { status: 'no_face' | 'multi_face' }>;
  /** 행사 사진 속 얼굴 모두 등록 */
  indexPhoto(collectionId: string, image: Buffer, externalId: string): Promise<IndexedFace[]>;
  /** 얼굴이 없을 때: 사람(뒷모습 등)이 찍혔는지 */
  hasPerson(image: Buffer): Promise<boolean>;
  /** 이 얼굴과 닮은 얼굴 모두 찾기 */
  searchFace(collectionId: string, faceId: string, minSimilarity: number): Promise<FaceMatch[]>;
  deleteFaces(collectionId: string, faceIds: string[]): Promise<void>;
}

let client: RekognitionClient | null = null;
function rk(): RekognitionClient {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error('서버 설정 오류: 얼굴 인식(AWS) 키가 설정되지 않았습니다.');
  }
  if (!client) client = new RekognitionClient({ region: process.env.AWS_REGION || 'ap-northeast-2' });
  return client;
}

const toBox = (b: { Left?: number; Top?: number; Width?: number; Height?: number } | undefined): BBox => ({
  left: b?.Left ?? 0,
  top: b?.Top ?? 0,
  width: b?.Width ?? 0,
  height: b?.Height ?? 0,
});

const awsProvider: FaceProvider = {
  async ensureCollection(collectionId) {
    try {
      await rk().send(new CreateCollectionCommand({ CollectionId: collectionId }));
    } catch (e: any) {
      if (e?.name !== 'ResourceAlreadyExistsException') throw e;
    }
  },
  async deleteCollection(collectionId) {
    try {
      await rk().send(new DeleteCollectionCommand({ CollectionId: collectionId }));
    } catch (e: any) {
      if (e?.name !== 'ResourceNotFoundException') throw e;
    }
  },
  async enrollFace(collectionId, image, externalId) {
    const out = await rk().send(
      new IndexFacesCommand({
        CollectionId: collectionId,
        Image: { Bytes: image },
        ExternalImageId: externalId,
        MaxFaces: 2,
        QualityFilter: 'AUTO',
      })
    );
    const faces = out.FaceRecords || [];
    if (faces.length === 0) return { status: 'no_face' };
    if (faces.length > 1 || (out.UnindexedFaces || []).length > 0) return { status: 'multi_face' };
    return { status: 'ok', faceId: String(faces[0].Face?.FaceId) };
  },
  async indexPhoto(collectionId, image, externalId) {
    const out = await rk().send(
      new IndexFacesCommand({
        CollectionId: collectionId,
        Image: { Bytes: image },
        ExternalImageId: externalId,
        MaxFaces: 100,
        QualityFilter: 'AUTO',
      })
    );
    return (out.FaceRecords || []).map(r => ({ faceId: String(r.Face?.FaceId), bbox: toBox(r.Face?.BoundingBox) }));
  },
  async hasPerson(image) {
    const out = await rk().send(new DetectLabelsCommand({ Image: { Bytes: image }, MaxLabels: 20, MinConfidence: 70 }));
    return (out.Labels || []).some(l => ['Person', 'Human', 'People', 'Crowd'].includes(String(l.Name)));
  },
  async searchFace(collectionId, faceId, minSimilarity) {
    const out = await rk().send(
      new SearchFacesCommand({ CollectionId: collectionId, FaceId: faceId, MaxFaces: 4096, FaceMatchThreshold: minSimilarity })
    );
    return (out.FaceMatches || []).map(m => ({
      faceId: String(m.Face?.FaceId),
      externalId: String(m.Face?.ExternalImageId || ''),
      similarity: Number(m.Similarity || 0),
    }));
  },
  async deleteFaces(collectionId, faceIds) {
    for (let i = 0; i < faceIds.length; i += 1000) {
      try {
        await rk().send(new DeleteFacesCommand({ CollectionId: collectionId, FaceIds: faceIds.slice(i, i + 1000) }));
      } catch (e: any) {
        if (e?.name !== 'ResourceNotFoundException') throw e;
      }
    }
  },
};

export function getFaceProvider(): FaceProvider {
  return awsProvider;
}

/** 행사별 얼굴 모음 이름 */
export const collectionIdFor = (eventId: string) => `moimteo-${eventId}`.replace(/[^a-zA-Z0-9_.\-]/g, '_');
