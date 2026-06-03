import { workspaceLeads, workspaceLessons, workspaceStudents } from './mock-data';
import type { Lead, Lesson, StudentProfile, User } from './types';

export function canAccessStudent(user: User, student: StudentProfile) {
  if (user.role === 'admin') {
    return true;
  }

  if (user.role === 'advisor') {
    return student.advisorId === user.id;
  }

  if (user.role === 'teacher') {
    return student.teacherIds.includes(user.id);
  }

  return student.userId === user.id;
}

export function canAccessLead(user: User, lead: Lead) {
  if (user.role === 'admin') {
    return true;
  }

  if (user.role === 'advisor') {
    return lead.advisorId === user.id;
  }

  return false;
}

export function canAccessLesson(user: User, lesson: Lesson) {
  if (user.role === 'admin') {
    return true;
  }

  if (user.role === 'teacher') {
    return lesson.teacherId === user.id;
  }

  if (user.role === 'student') {
    const student = workspaceStudents.find((item) => item.id === lesson.studentId);
    return student?.userId === user.id;
  }

  if (user.role === 'advisor') {
    const student = workspaceStudents.find((item) => item.id === lesson.studentId);
    return student?.advisorId === user.id;
  }

  return false;
}

export function getVisibleStudents(user: User, students = workspaceStudents) {
  return students.filter((student) => canAccessStudent(user, student));
}

export function getVisibleLeads(user: User, leads = workspaceLeads) {
  return leads.filter((lead) => canAccessLead(user, lead));
}

export function getVisibleLessons(user: User, lessons = workspaceLessons) {
  return lessons.filter((lesson) => canAccessLesson(user, lesson));
}
